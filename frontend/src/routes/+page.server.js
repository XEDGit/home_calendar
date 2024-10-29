export async function load() {
	try {
		let response = await fetch('http://backend:3000/events');
		const events = await response.json();
		response = await fetch('http://backend:3000/rooms');
		const rooms = await response.json();
		response = await fetch('http://backend:3000/chores');
		const chores = await response.json();
		return { events, rooms, chores };
	} catch (error) {
		console.error("Error fetching events:", error);
		return { events: [], rooms: [], chores: [] }; // Return empty array if fetch fails
	}
}