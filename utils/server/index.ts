import { Message } from '@/types/chat';
import { OpenAIModel } from '@/types/openai';
import { Humanloop } from "humanloop"
import { AZURE_DEPLOYMENT_ID, OPENAI_API_HOST, OPENAI_API_TYPE, OPENAI_API_VERSION, OPENAI_ORGANIZATION } from '../app/const';

import {
  ParsedEvent,
  ReconnectInterval,
  createParser,
} from 'eventsource-parser';
import { debug } from 'console';
import { measureMemory } from 'vm';

export class OpenAIError extends Error {
  type: string;
  param: string;
  code: string;

  constructor(message: string, type: string, param: string, code: string) {
    super(message);
    this.name = 'OpenAIError';
    this.type = type;
    this.param = param;
    this.code = code;
  }
}

export const OpenAIStream = async (
  model: OpenAIModel,
  systemPrompt: string,
  temperature : number,
  key: string,
  messages: Message[],
) => {
  let url = `${OPENAI_API_HOST}/v1/chat/completions`;
  if (OPENAI_API_TYPE === 'azure') {
    url = `${OPENAI_API_HOST}/openai/deployments/${AZURE_DEPLOYMENT_ID}/chat/completions?api-version=${OPENAI_API_VERSION}`;
  }
  //gpt-3.5-turbo

  console.log("-elton:",messages[messages.length-1].content)

  const options = {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/json',
      'X-API-KEY': 'hl_sk_904d85db5194ff1e2fef87b39a6fbe58888ac1ecdab60d04',
    },
    body: JSON.stringify({
      "project": "旅行助手",
      "inputs": {
      "text": messages[messages.length-1].content
    },
      "provider_api_keys": {
      "openai": "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"
    }
    })
  };
  let res = await fetch('https://api.humanloop.com/v3/generate', options)
  let data = await res.json()

//   const res = await fetch(url, {
//     headers: {
//       'Content-Type': 'application/json',
//       ...(OPENAI_API_TYPE === 'openai' && {
//         Authorization: `Bearer ${key ? key : process.env.OPENAI_API_KEY}`
//       }),
//       ...(OPENAI_API_TYPE === 'azure' && {
//         'api-key': `${key ? key : process.env.OPENAI_API_KEY}`
//       }),
//       ...((OPENAI_API_TYPE === 'openai' && OPENAI_ORGANIZATION) && {
//         'OpenAI-Organization': OPENAI_ORGANIZATION,
//       }),
//     },
//     method: 'POST',
//     body: JSON.stringify({
//       ...(OPENAI_API_TYPE === 'openai' && {model: model.id}),
//       messages: [
//         {
//           role: 'system',
//           content: systemPrompt,
//         },
//         ...messages,
//       ],
//       max_tokens: 1000,
//       temperature: temperature,
//       stream: true,
//     }),
//   });


  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  if (res.status !== 200) {
    const result = await res.json();
    console.log('异常状态返回',res.status,result.data)

     // Make this code easier to read, including by adding comments, renaming variables, and/or reorganizing the code.
    if (result.error) {
      throw new OpenAIError(
        result.error.message,
        result.error.type,
        result.error.param,
        result.error.code,
      );
    } else {
      throw new Error(
        `OpenAI API returned an error: ${
          decoder.decode(result?.value) || result.statusText
        }`,
      );
    }
  }
  console.log('status:--------------',res.status)
  const stream = new ReadableStream({
    async start(controller) {
      const onParse = (event: ParsedEvent | ReconnectInterval) => {
        if (event.type === 'event') {
          const data = event.data;

          try {
            const json = JSON.parse(data);
            if (json.choices[0].finish_reason != null) {
              controller.close();
              return;
            }
            const text = json.choices[0].delta.content;
            const queue = encoder.encode(text);
            controller.enqueue(queue);
          } catch (e) {
            controller.error(e);
          }
        }
      };

      const parser = createParser(onParse);
      console.log('---------------',res)
      for await (const chunk of res.body as any) {
        parser.feed(decoder.decode(chunk));
      }
    },
  });

  return stream;
};
