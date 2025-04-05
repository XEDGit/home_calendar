export function getCookie(name) {
	const cookieArr = document.cookie.split(';');
	for (let i = 0; i < cookieArr.length; i++) {
		let cookie = cookieArr[i].trim();
		if (cookie.startsWith(name + '=')) {
			return cookie.substring(name.length + 1, cookie.length);
		}
	}
	return null;
}

export function setCookie(name, value, days) {
	const date = new Date();
	date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000)); // Expiry in days
	const expires = `expires=${date.toUTCString()}`;
	document.cookie = `${name}=${value}; ${expires}; path=/`; // Setting the cookie
}
