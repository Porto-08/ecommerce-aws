import { Construct } from 'constructs'
import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cdk from 'aws-cdk-lib'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import * as events from 'aws-cdk-lib/aws-events'
import * as target from 'aws-cdk-lib/aws-events-targets'

export class AuditEventBusStack extends cdk.Stack {
  readonly bus: events.EventBus;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    this.bus = new events.EventBus(this, "AuditEventBus", {
      eventBusName: 'AuditEventBus'
    });

    this.bus.archive('BusArchive', {
      eventPattern: {
        source: ['app.order']
      },
      archiveName: 'auditEvents',
      retention: cdk.Duration.days(10)
    });
  };
};