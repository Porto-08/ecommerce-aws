import { APIGatewayProxyResult, Context } from 'aws-lambda';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { OrderEventRepository, OrderEventDdb } from '/opt/nodejs/ordersEventsRepositoryLayer';

import { DynamoDB } from "aws-sdk";
import * as AWSRay from "aws-xray-sdk";

AWSRay.captureAWS(require("aws-sdk"));

const ddbClient = new DynamoDB.DocumentClient();
const eventsDdb = process.env.EVENTS_DDB!;
const orderEventsRepository = new OrderEventRepository(ddbClient, eventsDdb);

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
  const email = event.queryStringParameters!.email!;
  const eventType = event.queryStringParameters!.eventType;

  if (eventType) {
    const events = await orderEventsRepository.getOrderEventsByEmailAndEventType(email, eventType);
    return {
      statusCode: 200,
      body: JSON.stringify(convertOrderEvents(events)),
    };
  } else {
    const events = await orderEventsRepository.getOrderEventsByEmail(email);
    return {
      statusCode: 200,
      body: JSON.stringify(convertOrderEvents(events)),
    };
  }
}

function convertOrderEvents(orderEvents: OrderEventDdb[]) {
  return orderEvents.map(orderEvent => ({
    email: orderEvent.email,
    createdAt: orderEvent.createdAt,
    eventType: orderEvent.eventType,
    requestId: orderEvent.requestId,
    orderId: orderEvent.info.orderId,
    productCodes: orderEvent.info.productCodes,
  }));
};