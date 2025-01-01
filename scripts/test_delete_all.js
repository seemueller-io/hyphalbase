(async () => {
	await fetch('http://localhost:8787', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			operation: 'deleteAll',
		}),
	}).then(async r => console.log(await r.json()));
})()
