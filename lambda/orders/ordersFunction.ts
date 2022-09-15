import { CarrierType, PaymentType, ShippingType } from './layers/ordersApiLayer/nodejs/ordersApi';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Product, ProductRepository } from '/opt/nodejs/productsLayer';
import { Order, OrderProduct, OrderRepository } from '/opt/nodejs/ordersLayer';
import { DynamoDB } from 'aws-sdk';
import * as AWSRay from 'aws-xray-sdk';
import { OrderProductRespose, OrderRequest, OrderResponse } from '/opt/nodejs/ordersApiLayer';

AWSRay.captureAWS(require('aws-sdk'));

const ordersDdb = process.env.ORDERS_DDB!;
const productsDdb = process.env.PRODUCTS_DDB!;
const ddbClient = new DynamoDB.DocumentClient();

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
    const orderCreated = await orderRepository.createOrder(order);

    return {
      statusCode: 201,
      body: JSON.stringify(converToOrderResponse(orderCreated)),
    }
  } else if (method === 'DELETE') {
    console.log('DELETE /orders');


    const email = event.queryStringParameters!.email!;
    const orderId = event.queryStringParameters!.orderId!;

    try {
      const orderDeleted = await orderRepository.deleteOrder(email, orderId);

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

function converToOrderResponse(order: Order): OrderResponse {
  const orderProducts: OrderProductRespose[] = [];

  order.products.forEach((product) => {
    orderProducts.push({
      code: product.code,
      price: product.price,
    });
  });

  const orderResponse: OrderResponse = {
    email: order.pk,
    id: order.sk!,
    createdAt: order.createdAt!,
    products: orderProducts,
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
