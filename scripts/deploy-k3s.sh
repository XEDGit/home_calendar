#!/usr/bin/env bash
# Build, push and roll out home-calendar's frontend and backend on k3s.
#
#   scripts/deploy-k3s.sh [changed | all | frontend | backend ...]
#
# changed (the default) deploys only the services whose directory differs
# from the image the cluster runs now. The backend Deployment is one replica
# with the Recreate strategy, so redeploying it for nothing would cut off
# assistant chats in progress.
#
# Images are tagged with the commit (git rev-parse --short HEAD), so a
# service's directory must be committed before it ships. ALLOW_DIRTY=1
# builds it anyway, tagged <commit>-dirty-<time>, to try something out first.
#
# Steps: tests, docker build + push to the local registry, bump the image tag
# in the k3s manifest, kubectl apply, wait for the rollout, commit the
# manifest in its own repo (~/k3s), the way earlier deploys were recorded.
#
# Env: K3S_MANIFEST, REGISTRY, NAMESPACE, KUBECONFIG,
#      ALLOW_DIRTY=1, SKIP_TESTS=1, DRY_RUN=1 (print what would run)
set -euo pipefail

cd "$(dirname "$0")/.."
MANIFEST=${K3S_MANIFEST:-$HOME/k3s/home-calendar/calendar.yaml}
REGISTRY=${REGISTRY:-127.0.0.1:30500}
NAMESPACE=${NAMESPACE:-home-calendar}
export KUBECONFIG=${KUBECONFIG:-$HOME/.kube/config}

if [[ -t 1 ]]; then bold=$'\033[1m' plain=$'\033[0m'; else bold='' plain=''; fi
say() { printf '%s==> %s%s\n' "$bold" "$*" "$plain"; }
die() { printf 'deploy: %s\n' "$*" >&2; exit 1; }
run() { if [[ -n ${DRY_RUN:-} ]]; then printf '+ %s\n' "$*"; else "$@"; fi; }

[[ -f $MANIFEST ]] || die "manifest not found: $MANIFEST (set K3S_MANIFEST)"
K3S_REPO=$(git -C "$(dirname "$MANIFEST")" rev-parse --show-toplevel)
[[ -z $(git -C "$K3S_REPO" status --porcelain -- "$MANIFEST") ]] ||
	die "$MANIFEST has uncommitted changes; commit or discard them first"

HEAD=$(git rev-parse --short HEAD)

# The tag the manifest gives service $1, e.g. c9d5e3e
deployed() {
	sed -n "s#^ *image: $REGISTRY/calendar-$1:\(.*\)\$#\1#p" "$MANIFEST" | head -1
}
dirty() { [[ -n $(git status --porcelain --untracked-files=all -- "$1") ]]; }
# Does service $1 differ from what the cluster runs?
changed() {
	local tag; tag=$(deployed "$1")
	[[ -z $tag || $tag == *-* ]] && return 0           # unknown, or a preview build
	dirty "$1" && return 0
	git cat-file -e "$tag^{commit}" 2>/dev/null || return 0
	! git diff --quiet "$tag" HEAD -- "$1"
}

services=()
for arg in "${@:-changed}"; do
	case $arg in
		changed) for s in frontend backend; do changed "$s" && services+=("$s"); done ;;
		all) services+=(frontend backend) ;;
		frontend | backend) services+=("$arg") ;;
		*) die "unknown target '$arg' (use changed, all, frontend or backend)" ;;
	esac
done
# Keep the order, drop repeats
read -r -a services <<<"$(printf '%s\n' "${services[@]}" | awk 'NF && !seen[$0]++' | tr '\n' ' ')"
if [[ ${#services[@]} -eq 0 ]]; then
	say "Nothing to deploy: no changes up to HEAD ($HEAD) since the running frontend $(deployed frontend) and backend $(deployed backend)"
	exit 0
fi

declare -A tags
for s in "${services[@]}"; do
	[[ -n $(deployed "$s") ]] || die "no '$REGISTRY/calendar-$s:' image line in $MANIFEST"
	tags[$s]=$HEAD
	if dirty "$s"; then
		[[ -n ${ALLOW_DIRTY:-} ]] ||
			die "$s/ has uncommitted changes (git status -- $s). Commit them, or set ALLOW_DIRTY=1 for a preview build."
		tags[$s]=$HEAD-dirty-$(date +%Y%m%d%H%M%S)
	fi
done

if [[ -z ${SKIP_TESTS:-} ]]; then
	for s in "${services[@]}"; do
		say "Testing $s"
		if [[ -n ${DRY_RUN:-} ]]; then run npm --prefix "$s" test; continue; fi
		log=$(mktemp)
		npm --prefix "$s" test >"$log" 2>&1 || { tail -n 40 "$log"; rm -f "$log"; die "$s tests failed (SKIP_TESTS=1 to deploy anyway)"; }
		grep -E '^# (pass|fail|skipped)' "$log" | tr '\n' ' '; echo
		rm -f "$log"
	done
fi

for s in "${services[@]}"; do
	image=$REGISTRY/calendar-$s:${tags[$s]}
	say "Building $image (running now: $(deployed "$s"))"
	run docker build -q -t "$image" "$s"
	run docker push -q "$image"
	run sed -i "s#^\( *image: $REGISTRY/calendar-$s:\).*#\1${tags[$s]}#" "$MANIFEST"
	[[ -n ${DRY_RUN:-} || $(deployed "$s") == "${tags[$s]}" ]] || die "could not update the $s image in $MANIFEST"
done

say "Applying $MANIFEST"
run kubectl apply -f "$MANIFEST"
for s in "${services[@]}"; do
	run kubectl -n "$NAMESPACE" rollout status "deploy/$s" --timeout=180s ||
		die "$s did not roll out. The manifest is updated but not committed. Undo with:
  kubectl -n $NAMESPACE rollout undo deploy/$s && git -C $K3S_REPO checkout -- $MANIFEST"
done

# "frontend+backend c9d5e3e", or each with its own tag when they differ
summary=""
for s in "${services[@]}"; do summary+="${summary:+, }$s ${tags[$s]}"; done
if [[ ${#services[@]} -gt 1 && $(printf '%s\n' "${tags[@]}" | sort -u | wc -l) -eq 1 ]]; then
	summary="$(IFS=+; echo "${services[*]}") ${tags[${services[0]}]}"
fi
subject=$(git log -1 --format=%s)
[[ ${tags[*]} == *-dirty-* ]] && subject+=" + uncommitted changes"
say "Recording the deploy in $K3S_REPO"
run git -C "$K3S_REPO" commit -q -m "Deploy home-calendar $summary ($subject)" -- "$MANIFEST"

say "Deployed $summary"
