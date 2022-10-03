import { DocumentClient } from "aws-sdk/clients/dynamodb";

export enum InvoiceTransactionStatus {
  GENERATED = 'URL_GENERATED',
  RECEIVED = 'INVOICE_RECEIVED',
  PROCESSED = 'INVOICE_PROCESSED',
  TIMEOUT = 'TIMEOUT',
  CANCELED = 'INVOICE_CANCELED',
  NOT_VALID_INVOICE_NUMBER = 'NOT_VALID_INVOICE_NUMBER',
  NOT_FOUND = 'NOT_FOUND',
}

export interface InvoiceTransaction {
  pk: string;
  sk: string;
  ttl: number;
  requestId: string;
  timestamp: number;
  expiresIn: number;
  connectionId: string;
  endpoint: string;
  transationStatus: InvoiceTransactionStatus;
}

export class InvoiceTransationRepository {
  private ddbClient: DocumentClient;
  private invoiceTransactionDdb: string;

  constructor(ddbClient: DocumentClient, invoiceTransactionDdb: string) {
    this.ddbClient = ddbClient;
    this.invoiceTransactionDdb = invoiceTransactionDdb;
  }

  async createInvoiceTransaction(invoiceTransaction: InvoiceTransaction): Promise<InvoiceTransaction> {
    await this.ddbClient.put({
      TableName: this.invoiceTransactionDdb,
      Item: invoiceTransaction,
    }).promise();

    return invoiceTransaction;
  }

  async getInvoiceTransaction(key: string): Promise<InvoiceTransaction> {
    const transaction = await this.ddbClient.get({
      TableName: this.invoiceTransactionDdb,
      Key: {
        pk: '#transaction',
        sk: key,
      }
    }).promise();

    if (!transaction.Item) {
      throw new Error('Transaction not found');
    }

    return transaction.Item as InvoiceTransaction;
  };

  async updateInvoiceTransaction(key: string, status: InvoiceTransactionStatus): Promise<boolean> {
    try {
      await this.ddbClient.update({
        TableName: this.invoiceTransactionDdb,
        Key: {
          pk: '#transaction',
          sk: key,
        },
        ConditionExpression: 'attribute_exists(pk)',
        UpdateExpression: 'set transationStatus = :status',
        ExpressionAttributeValues: {
          ':status': status,
        }
      }).promise();

      return true;
    } catch (ConditionalCheckFailedException) {
      console.error(ConditionalCheckFailedException);
      return false;
    }
  }
}