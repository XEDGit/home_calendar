import { getBackend } from '$lib/requests';

export async function GET({ request, url }) {
    // Get date range parameters from query string if present
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    
    // Build the endpoint URL with date range parameters if provided
    let endpoint = 'events';
    if (startDate && endDate) {
        endpoint += `?startDate=${startDate}&endDate=${endDate}`;
    }
    
    return await getBackend(request, endpoint);
}
