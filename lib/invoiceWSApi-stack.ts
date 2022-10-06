import * as cdk from 'aws-cdk-lib';
import * as apigatewayv2 from '@aws-cdk/aws-apigatewayv2-alpha';
import * as apigatewayv2_integrations from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as events from 'aws-cdk-lib/aws-events'
import { Construct } from 'constructs';

interface InvoiceWsApiStackprops extends cdk.StackProps {
  eventsDdb: dynamodb.Table;
  auditBus: events.EventBus;
}

export class InvoiceWSApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: InvoiceWsApiStackprops) {
    super(scope, id, props);

    // Parameters

    const invoiceTransactionLayerArn = ssm.StringParameter.valueForStringParameter(this, 'InvoiceTransactionLayerVersionArn');
    const invoiceTransactionLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'InvoiceTransactionLayer', invoiceTransactionLayerArn);

    const invoiceRepositoryLayerArn = ssm.StringParameter.valueForStringParameter(this, 'InvoiceRepositoryLayerVersionArn');
    const invoiceRepositoryLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'InvoiceRepositoryLayer', invoiceRepositoryLayerArn);

    const invoiceWSConectionLayerArn = ssm.StringParameter.valueForStringParameter(this, 'InvoiceWSConectionLayerVersionArn');
    const invoiceWSConectionLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'InvoiceWSConectionLayer', invoiceWSConectionLayerArn);

    // Invoice and invoice transaction DDB
    const invoiceDdb = new dynamodb.Table(this, 'InvoiceDdb', {
      tableName: 'invoices',
      partitionKey: {
        name: 'pk',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'sk',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PROVISIONED,
      readCapacity: 1,
      writeCapacity: 1,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });


    // Invoice Bucket
    const bucket = new s3.Bucket(this, 'InvoiceBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [
        {
          enabled: true,
          expiration: cdk.Duration.days(1),
        },
      ],
    });

    // websockect connection handler
    const connectionHandler = new lambdaNodeJs.NodejsFunction(this, 'InvoiceConnectionFunction', {
      functionName: 'InvoiceConnectionFunction',
      entry: 'lambda/invoices/invoiceConnectionFunction.ts',
      handler: 'handler',
      memorySize: 128,
      timeout: cdk.Duration.seconds(2),
      bundling: {
        minify: true,
        sourceMap: false,
      },
      tracing: lambda.Tracing.ACTIVE,
    });

    // websocket disconnection handler
    const disconnectionHandler = new lambdaNodeJs.NodejsFunction(this, 'InvoiceDisconnectionFunction', {
      functionName: 'InvoiceDisconnectionFunction',
      entry: 'lambda/invoices/invoiceDisconnectionFunction.ts',
      handler: 'handler',
      memorySize: 128,
      timeout: cdk.Duration.seconds(2),
      bundling: {
        minify: true,
        sourceMap: false,
      },
      tracing: lambda.Tracing.ACTIVE,
    });

    // websocket API
    const webSocketApi = new apigatewayv2.WebSocketApi(this, 'InvoiceWSApi', {
      apiName: 'InvoiceWSApi',
      description: 'Invoice Websocket API',
      connectRouteOptions: {
        integration: new apigatewayv2_integrations.WebSocketLambdaIntegration('ConnectionHandler', connectionHandler),
      },
      disconnectRouteOptions: {
        integration: new apigatewayv2_integrations.WebSocketLambdaIntegration('DisconnectionHandler', disconnectionHandler),
      },
    });

    // websocket route
    const stage = 'prod';
    const wsAPiEndpoint = `${webSocketApi.apiEndpoint}/${stage}`;

    new apigatewayv2.WebSocketStage(this, 'InvoiceWSApiStage', {
      webSocketApi,
      stageName: stage,
      autoDeploy: true,
    });


    // Invoice URL handler
    const getUrlHandler = new lambdaNodeJs.NodejsFunction(this, 'InvoiceGetUrlFunction', {
      functionName: 'InvoiceGetUrlFunction',
      entry: 'lambda/invoices/invoiceGetUrlFunction.ts',
      handler: 'handler',
      memorySize: 128,
      timeout: cdk.Duration.seconds(2),
      bundling: {
        minify: true,
        sourceMap: false,
      },
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        INVOICE_DDB: invoiceDdb.tableName,
        BUCKET_NAME: bucket.bucketName,
        INVOICE_WSAPI_ENDPOINT: wsAPiEndpoint,
      },
      layers: [invoiceWSConectionLayer, invoiceTransactionLayer],
    });

    // Policys
    const invoicesDdbWriteTransactionPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['dynamodb:PutItem'],
      resources: [invoiceDdb.tableArn],
      conditions: {
        ['ForAllValues:StringLike']: {
          'dynamodb:LeadingKeys': ['#transaction'],
        }
      }
    });

    const invoicesBucketPutObjectPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:PutObject'],
      resources: [`${bucket.bucketArn}/*`],
    });

    // Permissions of Invoice URL handler
    getUrlHandler.addToRolePolicy(invoicesDdbWriteTransactionPolicy);
    getUrlHandler.addToRolePolicy(invoicesBucketPutObjectPolicy);
    webSocketApi.grantManageConnections(getUrlHandler);

    // Invoice import handler
    const invoiceImportHandler = new lambdaNodeJs.NodejsFunction(this, 'InvoiceImportFunction', {
      functionName: 'InvoiceImportFunction',
      entry: 'lambda/invoices/invoiceImportFunction.ts',
      handler: 'handler',
      memorySize: 128,
      timeout: cdk.Duration.seconds(2),
      bundling: {
        minify: true,
        sourceMap: false,
      },
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        INVOICE_DDB: invoiceDdb.tableName,
        INVOICE_WSAPI_ENDPOINT: wsAPiEndpoint,
        AUDIT_BUS_NAME: props.auditBus.eventBusName
      },
      layers: [invoiceWSConectionLayer, invoiceTransactionLayer, invoiceRepositoryLayer],
    });

    // Policys
    const invoicesBucketGetDeleteObjectPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:GetObject', 's3:DeleteObject'],
      resources: [`${bucket.bucketArn}/*`],
    })

    // Permissions of Invoice import handler
    invoiceDdb.grantReadWriteData(invoiceImportHandler);
    invoiceImportHandler.addToRolePolicy(invoicesBucketGetDeleteObjectPolicy);
    bucket.addEventNotification(s3.EventType.OBJECT_CREATED_PUT, new s3n.LambdaDestination(invoiceImportHandler));
    webSocketApi.grantManageConnections(invoiceImportHandler);
    props.auditBus.grantPutEventsTo(invoiceImportHandler)

    // Cancel import handler
    const cancelImportHandler = new lambdaNodeJs.NodejsFunction(this, 'CancelImportFunction', {
      functionName: 'CancelImportFunction',
      entry: 'lambda/invoices/cancelImportFunction.ts',
      handler: 'handler',
      memorySize: 128,
      timeout: cdk.Duration.seconds(2),
      bundling: {
        minify: true,
        sourceMap: false,
      },
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        INVOICE_DDB: invoiceDdb.tableName,
        INVOICE_WSAPI_ENDPOINT: wsAPiEndpoint,
      },
      layers: [invoiceWSConectionLayer, invoiceTransactionLayer],
    });

    // Policys
    const invoicesDdbReadWriteTransactionPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['dynamodb:GetItem', 'dybamodb:UpdateItem'],
      resources: [invoiceDdb.tableArn],
      conditions: {
        ['ForAllValues:StringLike']: {
          'dynamodb:LeadingKeys': ['#transaction'],
        }
      }
    });

    // Permissions of Cancel import handler
    cancelImportHandler.addToRolePolicy(invoicesDdbReadWriteTransactionPolicy);
    webSocketApi.grantManageConnections(cancelImportHandler);

    // Websocket API routes
    webSocketApi.addRoute('getImportUrl', {
      integration: new apigatewayv2_integrations.WebSocketLambdaIntegration('GetUrlHandler', getUrlHandler),
    });

    webSocketApi.addRoute('cancelImport', {
      integration: new apigatewayv2_integrations.WebSocketLambdaIntegration('CancelImportHandler', cancelImportHandler),
    });

    const invoiceEventsHandler = new lambdaNodeJs.NodejsFunction(this, 'InvoiceEventsFunction', {
      functionName: 'InvoiceEventsFunction',
      entry: 'lambda/invoices/invoiceEventsFunction.ts',
      handler: 'handler',
      memorySize: 128,
      timeout: cdk.Duration.seconds(2),
      bundling: {
        minify: true,
        sourceMap: false,
      },
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        EVENTS_DDB: props.eventsDdb.tableName,
        INVOICE_WSAPI_ENDPOINT: wsAPiEndpoint,
        AUDIT_BUS_NAME: props.auditBus.eventBusName
      },
      layers: [invoiceWSConectionLayer],
    });

    const invoiceEventsPolicys = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['dynamodb:PutItem'],
      resources: [props.eventsDdb.tableArn],
      conditions: {
        ['ForAllValues:StringLike']: {
          'dynamodb:LeadingKeys': ['#invoice_*'],
        },
      },
    });

    invoiceEventsHandler.addToRolePolicy(invoiceEventsPolicys);
    webSocketApi.grantManageConnections(invoiceEventsHandler);
    props.auditBus.grantPutEventsTo(invoiceEventsHandler)

    const invoiceEventsDlq = new sqs.Queue(this, 'InvoiceEventsDlq', {
      queueName: 'invoice-events-dlq',
    });

    invoiceEventsHandler.addEventSource(new lambdaEventSources.DynamoEventSource(invoiceDdb, {
      startingPosition: lambda.StartingPosition.TRIM_HORIZON,
      batchSize: 5,
      bisectBatchOnError: true,
      onFailure: new lambdaEventSources.SqsDlq(invoiceEventsDlq),
      retryAttempts: 3
    }));
  };
};