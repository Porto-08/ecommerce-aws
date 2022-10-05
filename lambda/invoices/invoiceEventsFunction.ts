import { Context, DynamoDBStreamEvent, AttributeValue } from 'aws-lambda';
import { ApiGatewayManagementApi, DynamoDB } from 'aws-sdk';
import { InvoiceWsService } from '/opt/nodejs/InvoiceWSConection';
import * as AWSXRay from 'aws-xray-sdk';

AWSXRay.captureAWS(require('aws-sdk'));

const eventsDdb = process.env.EVENTS_DDB!;
const invoiceWsApiEndpoint = process.env.INVOICE_WSAPI_ENDPOINT!;

const ddbClient = new DynamoDB.DocumentClient();
const apiGwManagementApi = new ApiGatewayManagementApi({
  endpoint: invoiceWsApiEndpoint,
});

const invoiceWsService = new InvoiceWsService(apiGwManagementApi)

export async function handler(event: DynamoDBStreamEvent, context: Context): Promise<void> {
  const promises: Promise<void>[] = []


  event.Records.forEach(record => {
    if (record.eventName === "INSERT") {

      if (record.dynamodb!.NewImage!.pk.S!.startsWith('#transaction')) {
        console.log('Invoice transaction event received')
      } else {
        console.log('Invoice event received')
        promises.push(createEvent(record.dynamodb!.NewImage!, "INVOICE_CREATED"))

      }
    } else if (record.eventName === "MODIFY") {
      console.log('Modify event')

      if (record.dynamodb!.NewImage!.pk.S!.startsWith('#transaction')) {
        console.log('Invoice transaction event received')
      } else {
        console.log('Invoice event received')
        promises.push(createEvent(record.dynamodb!.NewImage!, "INVOICE_CREATED"))

      }
    } else if (record.eventName === "REMOVE") {
      if (record.dynamodb!.OldImage!.pk.S === "#transaction") {
        console.log('Invoice Transaction event received')
        promises.push(processExpiredTransaction(record.dynamodb!.OldImage!))
      }
    }
  })

  await Promise.all(promises)

  return;
};

async function processExpiredTransaction(invoiceTransactionImage: { [key: string]: AttributeValue }) {
  const transactionId = invoiceTransactionImage.sk.S!
  const connectionId = invoiceTransactionImage.connectionId.S!
  const invoiceStatus = invoiceTransactionImage.transactionStatus.S!

  console.log(`TransactionId: ${transactionId} - ConnectionId: ${connectionId}`)

  if (invoiceStatus === "INVOICE_PROCESSED") {
    console.log('Invoice processed')
  } else {
    console.log(`Invoice import failed - Status: ${invoiceStatus}`)

    await invoiceWsService.sendInvoiceStatus(transactionId, connectionId, "TIMEOUT");

    await invoiceWsService.disconnetClient(connectionId);
  }
}

async function createEvent(invoiceImage: { [key: string]: AttributeValue }, eventType: string) {
  const timestamp = Date.now();
  const ttl = Math.round(timestamp / 1000 + 60 * 60);

  await ddbClient.put({
    TableName: eventsDdb,
    Item: {
      pk: `#invoice_${invoiceImage.sk.S}`,
      sk: `${eventType}#${timestamp}`,
      ttl,
      email: invoiceImage.pk.S!.split('_')[1],
      createdAt: timestamp,
      eventType,
      info: {
        transaction: invoiceImage.transactionId.S,
        productId: invoiceImage.productId.S,
        quantity: invoiceImage.quantity.N
      },
    },
  }).promise()

  return;
}