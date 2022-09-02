import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {

  const lambdaRequestID = context.awsRequestId
  const apiRequestID = event.requestContext.requestId

  console.log(`API Request ID: ${apiRequestID}`);
  console.log(`Lambda Request ID: ${lambdaRequestID}`);

  const method = event.httpMethod;
  const resource = event.resource;

  if (resource === '/products') {
    if (method === 'GET') {
      console.log('GET /products');

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'GET /products',
        }),
      };
    };
  };


  return {
    statusCode: 400,
    body: JSON.stringify({
      message: 'Invalid request',
      input: event,
    }, null, 2),
  };
}