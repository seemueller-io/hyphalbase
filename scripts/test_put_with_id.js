(async () => {
	const myUUID = '123e4567-e89b-12d3-a456-426614174000'; // Example UUID
	await fetch('http://localhost:8787', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			operation: 'put',
			payload: {
				id: myUUID,
				namespace: 'exampleNamespace',
				vector: [0.1, 0.2, 0.3],
				content: 'Sample content',
			},
		}),
	}).then(async r => console.log(await r.json()));
})()
