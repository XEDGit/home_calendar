export async function load() {
    const response = await fetch('https://backend:3000/rooms');

    if (!response.ok) {
        // Handle error response
        console.error('Failed to fetch rooms:', response.statusText);
        return {
            rooms: []
        };
    }

    const rooms = await response.json();
    return { rooms };
}