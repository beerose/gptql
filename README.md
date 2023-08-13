# gptql

Usage:

```ts
const client = gptqlClient({
  endpoint: "https://example.com/graphql",
  openaiApiKey: "<your-openai-api-key>",
});

const data = await client.query("I want to get all users");
```
