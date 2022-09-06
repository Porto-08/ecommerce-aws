import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {

  const lambdaRequestID = context.awsRequestId
  const apiRequestID = event.requestContext.requestId

  console.log(`API Request ID: ${apiRequestID} - Lambda Request ID: ${lambdaRequestID}`);

  const resource = event.resource;

  if (resource === '/products') {
    console.log('GET /products');

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'GET /products',
      }),
    };
  } else if (resource === '/products/{id}') {
    const productId = event.pathParameters?.id as string;
    console.log(`GET /products/${productId}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `GET /products/${productId}`,
      }),
    };

  }


  return {
    statusCode: 400,
    body: JSON.stringify({
      message: 'Bad request',
      input: event,
    }, null, 2),
  };
}