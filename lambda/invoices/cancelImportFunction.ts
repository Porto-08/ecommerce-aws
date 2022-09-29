import { InvoiceTransactionStatus } from '/opt/nodejs/invoiceTransaction';
import { InvoiceTransationRepository } from '/opt/nodejs/invoiceTransaction';
import { APIGatewayProxyEvent, APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { ApiGatewayManagementApi, DynamoDB } from 'aws-sdk';
import * as AWSXRay from 'aws-xray-sdk';
import { InvoiceWsService } from '/opt/nodejs/InvoiceWSConection';
import { InvoiceFile, InvoiceRepository } from '/opt/nodejs/invoiceRepository';

AWSXRay.captureAWS(require('aws-sdk'));

const invoicesDdb = process.env.INVOICE_DDB!;
const invoicesWSApiEndpoint = process.env.INVOICE_WSAPI_ENDPOINT!.substring(6);

const ddbClient = new DynamoDB.DocumentClient();
const apiGwManagementApi = new ApiGatewayManagementApi({
  endpoint: invoicesWSApiEndpoint,
});

const invoiceTransationRepository = new InvoiceTransationRepository(ddbClient, invoicesDdb);
const invoiceWsService = new InvoiceWsService(apiGwManagementApi);

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResultV2> {
  const transactionId = JSON.parse(event.body!).transactionId as string;

  const lambdaRequestId = context.awsRequestId;
  const connectionId = event.requestContext.connectionId!;

  console.log(`ConnectionID: ${connectionId} - Lambda Request ID: ${lambdaRequestId}`);

  try {
    const invoiceTransaction = await invoiceTransationRepository.getInvoiceTransaction(transactionId);

    if (invoiceTransaction.transationStatus === InvoiceTransactionStatus.GENERATED) {

      // Update the transaction status to Cancelled
      await Promise.all([
        invoiceWsService.sendInvoiceStatus(transactionId, connectionId, InvoiceTransactionStatus.CANCELED),
        invoiceTransationRepository.updateInvoiceTransaction(transactionId, InvoiceTransactionStatus.CANCELED),
      ]);
    } else {
      // Send the current status to the client and log the message
      await invoiceWsService.sendInvoiceStatus(transactionId, connectionId, invoiceTransaction.transationStatus);

      console.error(`Invoice ${transactionId} is already ${invoiceTransaction.transationStatus}, Can't cancel`);
    }
  } catch (error) {
    // Send the error to the client
    console.error(`Error: ${error}`);

    await invoiceWsService.sendInvoiceStatus(transactionId, connectionId, InvoiceTransactionStatus.NOT_FOUND);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({}),
  }
}