import { ProductRepository } from './layers/productsLayer/nodejs/productRepository';
import { DynamoDB } from 'aws-sdk';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";


const PRODUCTS_DDB = process.env.PRODUCTS_DDB!;
const ddbClient = new DynamoDB.DocumentClient();
const productRepository = new ProductRepository(ddbClient, PRODUCTS_DDB);


export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
  const lambdaRequestID = context.awsRequestId
  const apiRequestID = event.requestContext.requestId

  console.log(`API Request ID: ${apiRequestID} - Lambda Request ID: ${lambdaRequestID}`);

  const resource = event.resource;

  if (resource === '/products') {
    try {
      const products = await productRepository.getAllProducts();

      return {
        statusCode: 200,
        body: JSON.stringify(products),
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
    const productId = event.pathParameters!.id as string;

    try {
      const product = await productRepository.getProductById(productId);

      return {
        statusCode: 200,
        body: JSON.stringify(product),
      };
    } catch (error) {
      console.error((<Error>error).message);

      return {
        statusCode: 404,
        body: JSON.stringify((<Error>error).message),
      };
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