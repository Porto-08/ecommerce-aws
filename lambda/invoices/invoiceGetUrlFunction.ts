import { InvoiceTransationRepository, InvoiceTransactionStatus, InvoiceTransaction } from '/opt/nodejs/invoiceTransaction';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { ApiGatewayManagementApi, DynamoDB, S3 } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import * as AWSXRay from 'aws-xray-sdk';
import { InvoiceWsService } from '/opt/nodejs/InvoiceWSConection';


AWSXRay.captureAWS(require('aws-sdk'));

const invoicesDdb = process.env.INVOICE_DDB!;
const bucketName = process.env.BUCKET_NAME!;
const invoicesWSApiEndpoint = process.env.INVOICE_WSAPI_ENDPOINT!.substring(6);

const s3Client = new S3();
const ddbClient = new DynamoDB.DocumentClient();
const apiGwManagementApi = new ApiGatewayManagementApi({
  endpoint: invoicesWSApiEndpoint,
});

const invoiceTransationRepository = new InvoiceTransationRepository(ddbClient, invoicesDdb);
const invoiceWsService = new InvoiceWsService(apiGwManagementApi);

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
  // TODO - to be removed
  console.log('event', event);

  const lambdaRequestId = context.awsRequestId;
  const connectionId = event.requestContext.connectionId!;

  console.log(`connectionId: ${connectionId} - lambdaRequestId: ${lambdaRequestId}`);

  const key = uuidv4();
  const expires = 300

  const signedUrlPut = await s3Client.getSignedUrlPromise('putObject', {
    Bucket: bucketName,
    Key: key,
    Expires: expires,
  });

  // create invoice transaction
  const timestamp = Date.now();
  const ttl = Math.round(timestamp / 1000 + 60 * 2);
  const invoiceTransaction: InvoiceTransaction = {
    pk: '#transaction',
    sk: key,
    ttl,
    requestId: lambdaRequestId,
    timestamp,
    expiresIn: expires,
    connectionId,
    endpoint: invoicesWSApiEndpoint,
    transactionStatus: InvoiceTransactionStatus.GENERATED,
  }

  await invoiceTransationRepository.createInvoiceTransaction(invoiceTransaction)

  // Send URL to client
  const data = JSON.stringify({
    url: signedUrlPut,
    expires,
    transactionId: key,
  });

  const result = await invoiceWsService.sendData(connectionId, data);

  return {
    statusCode: 200,
    body: JSON.stringify({
      result,
    }),
  }
}