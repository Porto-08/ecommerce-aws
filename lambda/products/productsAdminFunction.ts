import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { DynamoDB } from "aws-sdk";
import { ProductRepository } from "/opt/nodejs/productsLayer";

const PRODUCTS_DDB = process.env.PRODUCTS_DDB!;
const ddbClient = new DynamoDB.DocumentClient();
const productRepository = new ProductRepository(ddbClient, PRODUCTS_DDB);

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
  const lambdaRequestID = context.awsRequestId
  const apiRequestID = event.requestContext.requestId

  console.log(`API Request ID: ${apiRequestID} - Lambda Request ID: ${lambdaRequestID}`);

  const resource = event.resource;
  const method = event.httpMethod;
  const body = event.body;

  if (resource === '/products') {


    return {
      statusCode: 201,
      body: JSON.stringify({
        message: `${method} /products`,
      }),
    }
  } else if (resource === '/products/{id}') {
    const productId = event.pathParameters?.id as string;

    if (method === 'PUT') {
      console.log(`${method} /products/${productId}`);

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: `${method} /products/${productId}`,
        }),
      }
    } else if (method === 'DELETE') {
      console.log(`${method} /products/${productId}`);

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: `${method} /products/${productId}`,
        }),
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