(async () => {

const response = await fetch('http://localhost:8787', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			operation: 'put',
			payload: {
				namespace: 'exampleNamespace',
				vector: [0.1, 0.2, 0.3],
				content: 'Sample content',
			},
		}),
	});

	console.log({response: await response.json()});

})()
