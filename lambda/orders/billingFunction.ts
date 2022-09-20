import { Context, SNSEvent } from 'aws-lambda';
import * as AWSRay from 'aws-xray-sdk';

AWSRay.captureAWS(require('aws-sdk'));

export async function handler(event: SNSEvent, context: Context): Promise<void> {
  console.log('Billing function');

  event.Records.forEach((record) => {
    console.log(record.Sns);
  });

  return;
}