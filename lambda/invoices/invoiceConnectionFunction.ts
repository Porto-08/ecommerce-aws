import { APIGatewayProxyResult } from 'aws-lambda';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import * as AWSRay from 'aws-xray-sdk';

AWSRay.captureAWS(require('aws-sdk'));

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
  console.log('event', event);

  return {
    statusCode: 200,
    body: 'OK',
  };
}