import { Product } from './layers/productsLayer/nodejs/productRepository';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { DynamoDB, Lambda } from "aws-sdk";
import { ProductEvent, ProductEventType } from "./layers/productEventsLayer/nodejs/productEvent";
import { ProductRepository } from "/opt/nodejs/productsLayer";
import * as AWSXRay from "aws-xray-sdk";

// Capture all the calls to AWS services 
AWSXRay.captureAWS(require('aws-sdk'));

const productsddb = process.env.PRODUCTS_DDB!;
const productsEventsFunctionName = process.env.PRODUCTS_EVENTS_FUNCTION_NAME!;

const ddbClient = new DynamoDB.DocumentClient();
const lambdaClient = new Lambda();
const productRepository = new ProductRepository(ddbClient, productsddb);



export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
  const lambdaRequestID = context.awsRequestId
  const apiRequestID = event.requestContext.requestId

  console.log(`API Request ID: ${apiRequestID} - Lambda Request ID: ${lambdaRequestID}`);

  const resource = event.resource;
  const method = event.httpMethod;
  const product = JSON.parse(event.body!) as Product;

  if (resource === '/products') {
    console.log(`Method: ${method}`);

    try {
      const createdProduct = await productRepository.createProduct(product);

      const response = await sendProductEvent(
        createdProduct,
        ProductEventType.CREATED,
        'admin@email.com',
        lambdaRequestID
      );

      console.log('Product Event Response: ', response);

      return {
        statusCode: 200,
        body: JSON.stringify(createdProduct),
      };
    } catch (error) {
      console.error((<Error>error).message);
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: 'Internal Server Error',
        }),
      };
    }
  } else if (resource === '/products/{id}') {
    const productId = event.pathParameters?.id as string;

    if (method === 'PUT') {
      console.log(`${method} /products/${productId}`);

      try {
        const updatedProduct = await productRepository.updateProduct(productId, product);

        const response = await sendProductEvent(
          updatedProduct,
          ProductEventType.UPDATED,
          'admin@email.com',
          lambdaRequestID
        );

        console.log('Product Event Response: ', response);

        return {
          statusCode: 200,
          body: JSON.stringify(updatedProduct),
        }
      } catch (ConditionCheckFailedException) {
        return {
          statusCode: 404,
          body: `Product with ID ${productId} not found`,
        };
      }
    } else if (method === 'DELETE') {
      console.log(`${method} /products/${productId}`);

      try {
        const deletedProduct = await productRepository.deleteProduct(productId);

        const response = await sendProductEvent(
          deletedProduct,
          ProductEventType.DELETED,
          'admin@email.com',
          lambdaRequestID
        );

        console.log('Product Event Response: ', response);

        return {
          statusCode: 200,
          body: JSON.stringify(deletedProduct),
        };
      } catch (error) {
        console.error((<Error>error).message);

        return {
          statusCode: 404,
          body: JSON.stringify((<Error>error).message),
        };
      }
    }
  }

  return {
    statusCode: 400,
    body: JSON.stringify({
      message: 'Bad request',
      input: event,
    }, null, 2),
  };
}

function sendProductEvent(product: Product, eventType: ProductEventType, email: string, lambdaRequestId: string) {
  const event: ProductEvent = {
    email,
    eventType,
    productCode: product.code,
    productId: product.id,
    productPrice: product.price,
    requestId: lambdaRequestId,
  }

  return lambdaClient.invoke({
    FunctionName: productsEventsFunctionName,
    Payload: JSON.stringify(event),
    InvocationType: 'RequestResponse',
  }).promise();
}