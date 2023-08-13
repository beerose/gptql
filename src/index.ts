import { Configuration, CreateChatCompletionRequest, OpenAIApi } from "openai";

function isRateLimitExceeded(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    typeof err["response"] === "object" &&
    err["response"] !== null &&
    "status" in err["response"] &&
    err["response"]["status"] === 429
  );
}

type Unpromisify<T extends Promise<any>> = T extends Promise<infer U>
  ? U
  : never;

export function gptqlClient({
  endpoint,
  openaiApiKey,
}: {
  endpoint: string;
  openaiApiKey: string;
}) {
  const configuration = new Configuration({ apiKey: openaiApiKey });
  const openai = new OpenAIApi(configuration);

  const schema = ``; // todo
  const getCompletionRequest = (
    prompt: string,
    operation: "query" /* | "mutation" | "subscription" */,
  ): CreateChatCompletionRequest => ({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content:
          "You can only reply GraphQL. You are a computer in charge of producing a valid GraphQL query.",
      },
      {
        role: "system",
        content: `Here is a GraphQL schema: ${schema}`,
      },
      {
        role: "user",
        content: prompt,
      },
      {
        role: "system",
        content: `Provide the GraphQL ${operation} that corresponds to the prompt above. You can only reply GraphQL.`,
      },
    ],
    temperature: 1,
  });

  return {
    query: async (prompt: string, requestOptions?: RequestInit) => {
      let completion: Unpromisify<
        ReturnType<typeof openai.createChatCompletion>
      >;
      try {
        completion = await openai.createChatCompletion(
          getCompletionRequest(prompt, "query"),
        );
      } catch (err) {
        if (isRateLimitExceeded(err)) {
          throw new Error("Rate limit exceeded");
        }
        throw err;
      }

      const gqlResponse = completion.data.choices[0]?.message?.content
        ?.match(/```\n[(query|mutation|subscription)\s*\{[\s\S]*?```/)
        ?.join()
        .replace("```\n", "")
        .replace("```", "");

      if (gqlResponse === undefined) {
        throw new Error("Failed to parse GraphQL response");
      }

      const result = await fetch(endpoint, {
        headers: {
          "Content-Type": "application/json",
        },
        ...requestOptions,
        method: "POST",
        body: JSON.stringify({
          prompt,
          schema,
        }),
      });

      const response: Record<string, any> = await result.json();

      return response;
    },
  };
}

const client = gptqlClient({
  endpoint: "https://example.com/graphql",
  openaiApiKey: "<your-openai-api-key>",
});

const data = await client.query("I want to get all users");
