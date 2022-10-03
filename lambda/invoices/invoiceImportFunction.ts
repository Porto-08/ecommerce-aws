import { InvoiceTransactionStatus, InvoiceTransationRepository } from '/opt/nodejs/invoiceTransaction';
import { Context, S3Event, S3EventRecord } from 'aws-lambda';
import { ApiGatewayManagementApi, DynamoDB, S3 } from 'aws-sdk';
import * as AWSXRay from 'aws-xray-sdk';
import { InvoiceWsService } from '/opt/nodejs/InvoiceWSConection';
import { InvoiceFile, InvoiceRepository } from '/opt/nodejs/invoiceRepository';

AWSXRay.captureAWS(require('aws-sdk'));

const invoicesDdb = process.env.INVOICE_DDB!;
const invoicesWSApiEndpoint = process.env.INVOICE_WSAPI_ENDPOINT!.substring(6);

const s3Client = new S3();
const ddbClient = new DynamoDB.DocumentClient();
const apiGwManagementApi = new ApiGatewayManagementApi({
  endpoint: invoicesWSApiEndpoint,
});

const invoiceTransationRepository = new InvoiceTransationRepository(ddbClient, invoicesDdb);
const invoiceWsService = new InvoiceWsService(apiGwManagementApi);
const invoiceRepository = new InvoiceRepository(ddbClient, invoicesDdb);

export async function handler(event: S3Event, context: Context): Promise<void> {
  const promises: Promise<void>[] = [];

  event.Records.forEach((record) => {
    promises.push(processRecord(record));
  })

  await Promise.all(promises);
}

async function processRecord(record: S3EventRecord): Promise<void> {
  const key = record.s3.object.key;

  try {
    const invoiceTransaction = await invoiceTransationRepository.getInvoiceTransaction(key);

    if (invoiceTransaction.transationStatus === InvoiceTransactionStatus.GENERATED) {
      await Promise.all([
        invoiceWsService.sendInvoiceStatus(key, invoiceTransaction.connectionId, InvoiceTransactionStatus.RECEIVED),
        invoiceTransationRepository.updateInvoiceTransaction(key, InvoiceTransactionStatus.RECEIVED),
      ]);
    } else {
      await invoiceWsService.sendInvoiceStatus(key, invoiceTransaction.connectionId, invoiceTransaction.transationStatus);

      console.log(`Invoice ${key} is already ${invoiceTransaction.transationStatus}`);

      return;
    }

    const object = await s3Client.getObject({
      Key: key,
      Bucket: record.s3.bucket.name,
    }).promise()

    const invoice = JSON.parse(object.Body!.toString('utf-8')) as InvoiceFile;

    if (invoice.invoiceNumber.length < 5) {
      await Promise.all([
        invoiceWsService.sendInvoiceStatus(key, invoiceTransaction.connectionId, InvoiceTransactionStatus.NOT_VALID_INVOICE_NUMBER),
        invoiceTransationRepository.updateInvoiceTransaction(key, InvoiceTransactionStatus.NOT_VALID_INVOICE_NUMBER),
      ]);

      invoiceWsService.disconnetClient(invoiceTransaction.connectionId);

      return;
    }

    const createInvoicePromise = invoiceRepository.create({
      pk: `#invoice_${invoice.customerName}`,
      sk: invoice.invoiceNumber,
      ttl: 0,
      totalValue: invoice.totalValue,
      productId: invoice.productId,
      quantity: invoice.quantity,
      transactionId: key,
      createdAt: Date.now(),
    });

    const deleteObjectPromise = s3Client.deleteObject({
      Key: key,
      Bucket: record.s3.bucket.name,
    }).promise();

    const updateInvoicePromise = invoiceTransationRepository.updateInvoiceTransaction(key, InvoiceTransactionStatus.PROCESSED);

    const sendStatusPromise = invoiceWsService.sendInvoiceStatus(key, invoiceTransaction.connectionId, InvoiceTransactionStatus.PROCESSED);

    await Promise.all([createInvoicePromise, deleteObjectPromise, updateInvoicePromise, sendStatusPromise]);
  } catch (error) {
    console.log(error);
  }
}