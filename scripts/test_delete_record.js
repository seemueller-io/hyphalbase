(async () => {
	const vectorId = '123e4567-e89b-12d3-a456-426614174000'; // The UUID of the vector
	await fetch('http://localhost:8787', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			operation: 'delete',
			payload: {
				id: vectorId,
			},
		}),
	});
})()
