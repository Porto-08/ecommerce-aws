import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ssm from "aws-cdk-lib/aws-ssm"
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs';


interface ProductsAppStackProps extends cdk.StackProps {
  eventsDdbTable: dynamodb.Table
}

export class ProductsAppStack extends cdk.Stack {
  readonly productsFetchHandler: lambdaNodeJs.NodejsFunction
  readonly productsAdminHandler: lambdaNodeJs.NodejsFunction
  readonly productsDdb: dynamodb.Table

  constructor(scope: Construct, id: string, props: ProductsAppStackProps) {
    super(scope, id, props);

    // Create a DynamoDB table
    this.productsDdb = new dynamodb.Table(this, 'ProductsDdb', {
      tableName: 'products',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PROVISIONED,
      readCapacity: 1,
      writeCapacity: 1,
    });

    // Products Layer
    const productsLayerArn = ssm.StringParameter.valueForStringParameter(this, 'ProductsLayerVersionArn');
    const productsLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'ProductsLayerVersionArn', productsLayerArn);


    // Products Events Layer
    const productEventsLayerArn = ssm.StringParameter.valueForStringParameter(this, 'ProductsEventsLayerVersionArn');
    const productEventsLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'ProductsEventsLayerVersionArn', productEventsLayerArn);

    // User Info Layer
    const authUserInfoLayerArn = ssm.StringParameter.valueForStringParameter(this, 'AuthUserInfoLayerVersionArn');
    const authUserInfoLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'AuthUserInfoLayerVersionArn', authUserInfoLayerArn);


    const productsEventsDlq = new sqs.Queue(this, 'ProductEventsDlq', {
      queueName: 'product-events-dlq',
      retentionPeriod: cdk.Duration.days(10),
    });


    // Events products
    const productsEventsHandler = new lambdaNodeJs.NodejsFunction(this, 'ProductsEventsFunction', {
      functionName: 'ProductsEventsFunction',
      entry: 'lambda/products/productsEventsFunction.ts',
      handler: 'handler',
      memorySize: 128,
      timeout: cdk.Duration.seconds(2),
      bundling: {
        minify: true,
        sourceMap: false,
      },
      environment: {
        EVENTS_DDB: props.eventsDdbTable.tableName,
      },
      tracing: lambda.Tracing.ACTIVE,
      layers: [productEventsLayer],
      deadLetterQueueEnabled: true,
      deadLetterQueue: productsEventsDlq,
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_98_0,
    });

    // Grant permissions to the Products Events Lambda to write to the Events DDB
    const eventsDdbPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['dynamodb:PutItem'],
      resources: [props.eventsDdbTable.tableArn],
      conditions: {
        ['ForAllValues:StringLike']: {
          'dynamodb:LeadingKeys': ['#product_*'],
        },
      },
    });

    productsEventsHandler.addToRolePolicy(eventsDdbPolicy);

    // Lambda Fetch products
    this.productsFetchHandler = new lambdaNodeJs.NodejsFunction(this, 'ProductsFetchFunction', {
      functionName: 'ProductsFetchFunction',
      entry: 'lambda/products/productsFetchFunction.ts',
      handler: 'handler',
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      bundling: {
        minify: true,
        sourceMap: false,
      },
      environment: {
        PRODUCTS_DDB: this.productsDdb.tableName,
      },
      layers: [productsLayer, authUserInfoLayer],
      tracing: lambda.Tracing.ACTIVE,
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_98_0,
    });

    // Grant the lambda role read access to the DynamoDB table
    this.productsDdb.grantReadData(this.productsFetchHandler);




    // lambda Admin products
    this.productsAdminHandler = new lambdaNodeJs.NodejsFunction(this, 'ProductsAdminFunction', {
      functionName: 'ProductsAdminFunction',
      entry: 'lambda/products/productsAdminFunction.ts',
      handler: 'handler',
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      bundling: {
        minify: true,
        sourceMap: false,
      },
      environment: {
        PRODUCTS_DDB: this.productsDdb.tableName,
        PRODUCTS_EVENTS_FUNCTION_NAME: productsEventsHandler.functionName,
      },
      layers: [productsLayer, productEventsLayer, authUserInfoLayer],
      tracing: lambda.Tracing.ACTIVE,
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_98_0,
    });

    // Grant the lambda role write access to the DynamoDB table
    this.productsDdb.grantWriteData(this.productsAdminHandler);



    // Grant the lambda role invoke access to the events lambda
    productsEventsHandler.grantInvoke(this.productsAdminHandler);
  };
};


