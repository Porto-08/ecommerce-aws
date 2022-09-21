import { DynamoDB, SNS } from 'aws-sdk';
import { CarrierType, PaymentType, ShippingType } from './layers/ordersApiLayer/nodejs/ordersApi';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Product, ProductRepository } from '/opt/nodejs/productsLayer';
import { Order, OrderRepository } from '/opt/nodejs/ordersLayer';
import { OrderProductRespose, OrderRequest, OrderResponse } from '/opt/nodejs/ordersApiLayer';
import { OrderEvent, OrderEventType, Envelope } from '/opt/nodejs/ordersEventsLayer';
import { v4 as uuidv4 } from "uuid";
import * as AWSRay from 'aws-xray-sdk';

AWSRay.captureAWS(require('aws-sdk'));

const ordersDdb = process.env.ORDERS_DDB!;
const productsDdb = process.env.PRODUCTS_DDB!;
const orderEventsTopicArn = process.env.ORDER_EVENTS_TOPIC_ARN!;

const ddbClient = new DynamoDB.DocumentClient();
const snsClient = new SNS();

const orderRepository = new OrderRepository(ddbClient, ordersDdb);
const productRepository = new ProductRepository(ddbClient, productsDdb);

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const apiRequest = event.requestContext.requestId;
  const lambdaRequestId = context.awsRequestId;

  console.log(`API Request: ${apiRequest} - Lambda Request: ${lambdaRequestId}`);

  if (method === 'GET') {
    console.log('GET /orders');
    if (event.queryStringParameters) {
      const email = event.queryStringParameters!.email;
      const orderId = event.queryStringParameters!.orderId;

      if (email && orderId) {

        try {
          const order = await orderRepository.getOrder(email, orderId);

          return {
            statusCode: 200,
            body: JSON.stringify(converToOrderResponse(order)),
          }
        } catch (error) {
          console.log((<Error>error).message);
          return {
            statusCode: 404,
            body: (<Error>error).message,
          }
        }

      } else if (email) {
        const orders = await orderRepository.getOrdersByEmail(email);

        return {
          statusCode: 200,
          body: JSON.stringify(orders.map(converToOrderResponse)),
        }
      };
    };
    const orders = await orderRepository.getAllOrders();

    return {
      statusCode: 200,
      body: JSON.stringify(orders.map(converToOrderResponse)),
    }
  } else if (method === 'POST') {
    console.log('POST /orders');

    const orderRequest = JSON.parse(event.body!) as OrderRequest;
    const products = await productRepository.getProductsByIds(orderRequest.productIds);

    if (products.length !== orderRequest.productIds.length) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Some products were not found',
        }),
      };
    }

    const order = buildOrder(orderRequest, products);
    const orderCreatedPromisse = orderRepository.createOrder(order);
    const eventResultPromisse = sendOrderEvent(order, OrderEventType.CREATED, lambdaRequestId);

    const results = await Promise.all([orderCreatedPromisse, eventResultPromisse]);

    console.log(`Order created event sent - OrderId: ${order.sk} - MessageId: ${results[1].MessageId}`);

    return {
      statusCode: 201,
      body: JSON.stringify(converToOrderResponse(order)),
    };
  } else if (method === 'DELETE') {
    console.log('DELETE /orders');


    const email = event.queryStringParameters!.email!;
    const orderId = event.queryStringParameters!.orderId!;

    try {
      const orderDeleted = await orderRepository.deleteOrder(email, orderId);

      const eventResult = await sendOrderEvent(orderDeleted, OrderEventType.DELETED, lambdaRequestId);

      console.log(`Order deleted event sent - OrderId: ${orderDeleted.sk} - MessageId: ${eventResult.MessageId}`);

      return {
        statusCode: 200,
        body: JSON.stringify(converToOrderResponse(orderDeleted)),
      }
    } catch (error) {
      console.log((<Error>error).message);
      return {
        statusCode: 404,
        body: (<Error>error).message,
      }
    }
  };


  return {
    statusCode: 400,
    body: JSON.stringify({
      message: 'Bad Request',
    }),
  }
}

function sendOrderEvent(order: Order, eventType: OrderEventType, lambdaRequestId: string) {
  const productCodes = order.products?.map((product) => product.code);


  const orderEvent: OrderEvent = {
    productCodes: productCodes || [],
    email: order.pk,
    orderId: order.sk!,
    billing: order.billing,
    shipping: order.shipping,
    requesId: lambdaRequestId,
  }

  const evenlope: Envelope = {
    eventType: eventType,
    data: JSON.stringify(orderEvent),
  }

  return snsClient.publish({
    TopicArn: orderEventsTopicArn,
    Message: JSON.stringify(evenlope),
    MessageAttributes: {
      eventType: {
        DataType: 'String',
        StringValue: eventType,
      },
    },
  }).promise();
}

function converToOrderResponse(order: Order): OrderResponse {
  const orderProducts: OrderProductRespose[] = [];

  order.products?.forEach((product) => {
    orderProducts.push({
      code: product.code,
      price: product.price,
    });
  });

  const orderResponse: OrderResponse = {
    email: order.pk,
    id: order.sk!,
    createdAt: order.createdAt!,
    products: orderProducts.length ? orderProducts : undefined,
    billing: {
      payment: order.billing.payment as PaymentType,
      totalPrice: order.billing.totalPrice,
    },
    shipping: {
      carrier: order.shipping.carrier as CarrierType,
      type: order.shipping.type as ShippingType,
    },
  };

  return orderResponse;
}

function buildOrder(orderRequest: OrderRequest, products: Product[]): Order {

  const orderProducts: OrderProductRespose[] = [];
  let totalPrice = 0;

  products.forEach((product) => {
    orderProducts.push({
      code: product.code,
      price: product.price,
    });

    totalPrice += product.price;
  })

  const order: Order = {
    pk: orderRequest.email,
    sk: uuidv4(),
    createdAt: Date.now(),
    billing: {
      payment: orderRequest.payment,
      totalPrice: totalPrice,
    },
    shipping: {
      carrier: orderRequest.shipping.carrier,
      type: orderRequest.shipping.type,
    },
    products: orderProducts,
  }

  return order;
}