import { Context, Callback, APIGatewayProxyResult } from 'aws-lambda';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { OrderRepository } from './layers/nodejs/orderRepository';
import { DynamoDB } from "aws-sdk";
import { ProductRepository } from "/opt/nodejs/productsLayer";
import * as AWSXRay from "aws-xray-sdk";

AWSXRay.captureAWS(require("aws-sdk"));

const ordersDdb = process.env.ORDERS_DDB!;
const productsDdb = process.env.PRODUCTS_DDB!;

const ddbClient = new DynamoDB.DocumentClient();

const productRepository = new ProductRepository(ddbClient, productsDdb);
const orderRepository = new OrderRepository(ddbClient, ordersDdb);

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const apiRequestId = event.requestContext.requestId;
  const lambdaRequestID = context.awsRequestId;

  console.log(`API Request ID: ${apiRequestId} - Lambda Request ID: ${lambdaRequestID}`);

  if (method === 'GET') {
    if (event.queryStringParameters) {
      const email = event.queryStringParameters!.email;
      const orderId = event.queryStringParameters!.orderId;


      if (email && orderId) {
        const order = await orderRepository.getOrder(email, orderId);
        return {
          statusCode: 200,
          body: JSON.stringify(order),
        };
      }

      if (email) {
        const orders = await orderRepository.getOrdersByEmail(email);
        return {
          statusCode: 200,
          body: JSON.stringify(orders),
        };
      }
    }
    else {
      const orders = await orderRepository.getAllOrders();
      return {
        statusCode: 200,
        body: JSON.stringify(orders),
      };
    }

  } else if (method === 'POST') {
    console.log('POST');
  } else if (method === 'DELETE') {
    console.log('DELETE');

    const email = event.queryStringParameters!.email!;
    const order = event.queryStringParameters!.orderId!;

    const deletedOrder = await orderRepository.deleteOrder(email, order);

    return {
      statusCode: 200,
      body: JSON.stringify(deletedOrder),
    }
  }

  return {
    statusCode: 400,
    body: JSON.stringify({
      message: 'Invalid HTTP Method',
    }),
  }
}