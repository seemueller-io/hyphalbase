(async () => {
	const vectorId = '123e4567-e89b-12d3-a456-426614174000'; // The UUID of the vector
	fetch('http://localhost:8787', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			operation: 'get',
			payload: {
				id: vectorId,
			},
		}),
	})
		.then((response) => response.text())
		.then((data) => {
			console.log('Retrieved vector:', data);
		});
})()
