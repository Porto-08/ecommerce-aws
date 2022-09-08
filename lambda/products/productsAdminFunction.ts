import { Product } from './layers/productsLayer/nodejs/productRepository';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { DynamoDB } from "aws-sdk";
import { ProductRepository } from "/opt/nodejs/productsLayer";
import * as AWSXRay from "aws-xray-sdk";

// Capture all the calls to AWS services 
AWSXRay.captureAWS(require('aws-sdk'));

const PRODUCTS_DDB = process.env.PRODUCTS_DDB!;
const ddbClient = new DynamoDB.DocumentClient();
const productRepository = new ProductRepository(ddbClient, PRODUCTS_DDB);



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