import { Construct } from 'constructs'
import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ssm from "aws-cdk-lib/aws-ssm"
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as iam from 'aws-cdk-lib/aws-iam';


interface OrdersAppStackProps extends cdk.StackProps {
  productsDdb: dynamodb.Table;
  eventsDdb: dynamodb.Table;
}

export class OrdersAppStack extends cdk.Stack {
  readonly ordersHandler: lambdaNodeJs.NodejsFunction;

  constructor(scope: Construct, id: string, props: OrdersAppStackProps) {
    super(scope, id, props);

    const ordersDdb = new dynamodb.Table(this, 'OrdersDdb', {
      tableName: 'orders',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
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
    });

    // Products Layer
    const productsLayerArn = ssm.StringParameter.valueForStringParameter(this, 'ProductsLayerVersionArn');
    const productsLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'ProductsLayerVersionArn', productsLayerArn);

    // Orders Layer
    const ordersLayerArn = ssm.StringParameter.valueForStringParameter(this, 'OrdersLayerVersionArn');
    const ordersLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'OrdersLayerVersionArn ', ordersLayerArn);

    // Orders API Layer
    const ordersApiLayerArn = ssm.StringParameter.valueForStringParameter(this, 'OrdersApiLayerVersionArn');
    const ordersApiLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'OrdersApiLayerVersionArn ', ordersApiLayerArn);

    // Orders Events Layer
    const ordersEventsLayerArn = ssm.StringParameter.valueForStringParameter(this, 'OrdersEventsLayerVersionArn');
    const ordersEventsLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'OrdersEventsLayerVersionArn ', ordersEventsLayerArn);

    // Orders Repository Layer
    const ordersEventsRepositoryLayerArn = ssm.StringParameter.valueForStringParameter(this, 'OrdersEventsRepositoryLayerArn');
    const ordersEventsRepositoryLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'OrdersEventsRepositoryLayerArn ', ordersEventsRepositoryLayerArn);


    const ordersTopic = new sns.Topic(this, 'OrdersTopic', {
      displayName: 'Orders Events Topic',
      topicName: 'orders-events',
    });

    // Orders Handler
    this.ordersHandler = new lambdaNodeJs.NodejsFunction(this, 'OrdersFunction', {
      functionName: 'OrdersFunction',
      entry: 'lambda/orders/ordersFunction.ts',
      handler: 'handler',
      memorySize: 128,
      timeout: cdk.Duration.seconds(2),
      bundling: {
        minify: true,
        sourceMap: false,
      },
      environment: {
        ORDERS_DDB: ordersDdb.tableName,
        PRODUCTS_DDB: props.productsDdb.tableName,
        ORDER_EVENTS_TOPIC_ARN: ordersTopic.topicArn,
      },
      tracing: lambda.Tracing.ACTIVE,
      layers: [ordersLayer, productsLayer, ordersApiLayer, ordersEventsLayer],
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_98_0,
    });

    ordersDdb.grantReadWriteData(this.ordersHandler);

    // Grant permissions to the Orders Lambda to read from the Products DDB
    props.productsDdb.grantReadData(this.ordersHandler);

    // Grant permissions to the Orders Lambda to publish to the Orders Topic - SENDING MESSAGES
    ordersTopic.grantPublish(this.ordersHandler);


    // Orders Events Handler
    const ordersEventsHandler = new lambdaNodeJs.NodejsFunction(this, 'OrdersEventsFunction', {
      functionName: 'OrdersEventsFunction',
      entry: 'lambda/orders/ordersEventsFunction.ts',
      handler: 'handler',
      memorySize: 128,
      timeout: cdk.Duration.seconds(2),
      bundling: {
        minify: true,
        sourceMap: false,
      },
      environment: {
        EVENTS_DDB: props.eventsDdb.tableName,
      },
      tracing: lambda.Tracing.ACTIVE,
      layers: [ordersEventsRepositoryLayer],
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_98_0,
    });

    // Subscribe the Orders Events Lambda to the Orders Topic - RECEIVING MESSAGES
    ordersTopic.addSubscription(new subscriptions.LambdaSubscription(ordersEventsHandler));

    // Grant permissions to the Orders Events Lambda to write to the Events DDB
    const eventsDdbPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['dynamodb:PutItem'],
      resources: [props.eventsDdb.tableArn],
      conditions: {
        ['ForAllValues:StringLike']: {
          'dynamodb:LeadingKeys': ['#order_*'],
        },
      },
    });

    ordersEventsHandler.addToRolePolicy(eventsDdbPolicy);


    const billingHandler = new lambdaNodeJs.NodejsFunction(this, 'BillingFunction', {
      functionName: 'BillingFunction',
      entry: 'lambda/orders/billingFunction.ts',
      handler: 'handler',
      memorySize: 128,
      timeout: cdk.Duration.seconds(2),
      bundling: {
        minify: true,
        sourceMap: false,
      },
      tracing: lambda.Tracing.ACTIVE,
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_98_0,
    });

    // Subscribe the Orders Events Lambda to the Orders Topic - RECEIVING MESSAGES
    ordersTopic.addSubscription(new subscriptions.LambdaSubscription(billingHandler, {
      filterPolicy: {
        eventType: sns.SubscriptionFilter.stringFilter({
          allowlist: ['ORDER_CREATED'],
        })
      },
    }));
  };
};