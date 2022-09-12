import { Callback, Context } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import { ProductEvent } from './layers/productEventsLayer/nodejs/productEvent';
import * as AWSXRay from 'aws-xray-sdk';

AWSXRay.captureAWS(require('aws-sdk'));

const eventsDdb = process.env.EVENTS_DDB!;
const ddbClient = new DynamoDB.DocumentClient();

export const handler = async (event: ProductEvent, context: Context, callback: Callback): Promise<void> => {
  // Todo: to be removed
  console.log('Event: ', event);

  console.log('Lambda Request Id: ', context.awsRequestId);

  await createEvent(event)

  callback(null, JSON.stringify({
    productEventCreated: true,
    message: 'OK',
  }));
}

function createEvent(event: ProductEvent) {
  const timestamp = Date.now();
  const ttl = Math.round(timestamp / 1000 + 5 + 60); // 5 minutes ahead

  return ddbClient.put({
    TableName: eventsDdb,
    Item: {
      pk: `#product_${event.productCode}`,
      sk: `${event.eventType}#${timestamp}`,
      email: event.email,
      createdAt: timestamp,
      requestId: event.requestId,
      eventType: event.eventType,
      info: {
        productId: event.productId,
        productPrice: event.productPrice,
      },
      ttl
    }
  }).promise();
}