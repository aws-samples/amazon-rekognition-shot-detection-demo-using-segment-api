# RESTful API Component

The solution creates a RESTful API endpoint to allow communications between the webapp and the backend AWS Step Functions analysis state machine. No direct access to the state machine is allowed by the webapp. Each HTTP incoming request is also authenicated with AWS_IAM.

The following sections describe:
* The RESTful API endpoints
* and IAM role policy and permission

__

## Amazon API Gateway RESTful endpoint
The RESTful endpoint exposes the following operations.

| Purpose | Name | Method | Query | Body |
|:--------|:-----|:-------|:------|:-----|
| Get a list of analysis results | /\<stage\>/analyze | GET | stateMachine=\<state-machine-name\> | -- |
| Get a specific analysis result | /\<stage\>/analyze | GET | stateMachine=\<state-machine-name\>?execution=\<execution-name\> | -- |
| Start analysis | /\<stage\>/analyze | POST | stateMachine=\<state-machine-name\> | see details |
| Simple convert JSON into EDL | /\<stage\>/convert | POST | -- | see details |


where **\<stage\>** is a named reference to an [Amazon API Gateway](https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-stages.html) deployment created by the solution.

__

### Get a list of analysis results

**API**

```
/<stage>/analyze?stateMachine=<state-machine-name>

```


**Method**

```
GET
```

**Request**

The request is sent to the lambda function where it calls [AWS Step Functions ListExecutions](https://docs.aws.amazon.com/step-functions/latest/apireference/API_ListExecutions.html) to enumerate a list of executions. By default, it gets the 20 most recent executions.


**Query parameter**

| Key | Value | Mandatory | Description |
|:--- |:------|:----------|:------------|
| stateMachine | state machine name | required | State Machine is created the CFN stack |
| maxResults | maximum results to return | optional | Default is set to 20 |
| token | string | optional | A token is returned from the previous GET call if there are more results. It is used to page the next set of results. |
| filter | RUNNING, SUCCEEDED, FAILED, TIMED_OUT, or ABORTED | optional | If specified, filter by execution status |
| execution | execution name | optional | Use to get a specific execution status. See more detail later |

For example,

```
/<stage>/analyze?stateMachine=ml9801-your-state-machine

```

**Response**

The response is list of executions returned from [AWS Step Functions DescribeExecution](https://docs.aws.amazon.com/step-functions/latest/apireference/API_DescribeExecution.html) API that contains detail information of each execution.

```json
{
    "executions": [
        {
            "executionArn": "<execution-arn>",
            "stateMachineArn": "<state-machine-arn",
            "name": "<execution-name>",
            "status": "SUCCEEDED",
            "startDate": "2020-06-11T07:17:32.315Z",
            "stopDate": "2020-06-11T07:18:08.462Z",
            "input": "<JSON string of the input>",
            "output": "<JSON string of the output>"
        },
        ...
    ],
    "nextToken": "<next-token-if-more-executions>"
}

```

__

### Get a specific analysis result

**API**

```
/<stage>/analyze?stateMachine=<state-machine-name>?execution=<execution-name>

```


**Method**

```
GET
```

**Request**

The request is sent to the lambda function where it calls [AWS Step Functions DescribeExecution](https://docs.aws.amazon.com/step-functions/latest/apireference/API_DescribeExecution.html) and [GetExecutionHistory](https://docs.aws.amazon.com/step-functions/latest/apireference/API_GetExecutionHistory.html) to describe the specific execution.


**Query parameter**

| Key | Value | Mandatory | Description |
|:--- |:------|:----------|:------------|
| stateMachine | state machine name | required | State Machine is created the CFN stack |
| execution | execution name | required | Use to get a specific execution status. See more detail later |

For example,

```
/<stage>/analyze?stateMachine=ml9801-your-state-machine?execution=specific-execution-name

```

**Response**

The response is list of executions returned from [AWS Step Functions DescribeExecution](https://docs.aws.amazon.com/step-functions/latest/apireference/API_DescribeExecution.html) API and contained detail information of each execution.

```json
{
    "executionArn": "<execution-arn>",
    "stateMachineArn": "<state-machine-arn",
    "name": "<execution-name>",
    "status": "SUCCEEDED",
    "startDate": "2020-06-11T07:17:32.315Z",
    "stopDate": "2020-06-11T07:18:08.462Z",
    "input": "<JSON string of the input>",
    "output": "<JSON string of the output>"
}

```

__


### Start an analysis

**API**

```
/<stage>/analyze?stateMachine=ml9801-your-state-machine
```

**Method**

```
POST
```

**Request**

The request is sent to the lambda function where it calls [AWS Step Functions StartExecution](https://docs.aws.amazon.com/step-functions/latest/apireference/API_StartExecution.html) API to start the analysis state machine execution.

```json
{
    "input": {
        "bucket": "<source-bucket>",
        "key": "path/video.mp4"
    }
}

```

where

| Key | Value | Mandatory | Description |
|:--- |:------|:----------|:------------|
| input.bucket | bucket name | required | the Amazon S3 **source** bucket created by the CFN stack |
| input.key | key | required | the S3 object key of the video file |


**Response**

The response is same as _Get a specific analysis result._

```json
{
    "executionArn": "<execution-arn>",
    "stateMachineArn": "<state-machine-arn",
    "name": "<execution-name>",
    "status": "SUCCEEDED",
    "startDate": "2020-06-11T07:17:32.315Z",
    "stopDate": "2020-06-11T07:18:08.462Z",
    "input": "<JSON string of the input>",
    "output": "<JSON string of the output>"
}

```

__


### Simple convert Amazon Rekognition Segment JSON result to EDL format

**API**

```
/<stage>/convert
```

**Method**

```
POST
```

**Request**

The request is sent to the lambda function where it converts Amazon Rekgonition Segment JSON result into EDL format.

```json
{
    "name": "<string>",
    "data": "<JSON-object>"
}

```

where

| Key | Value | Mandatory | Description |
|:--- |:------|:----------|:------------|
| name | file name | required | A file name of the JSON file |
| data | JSON object | required | JSON object from Amazon Rekognition Segment API |


**Response**

The response contains EDL file.

```
TITLE: TEAROFSTEELS SEGMENT
FCM: NON-DROP FRAME

001  SHOT000  V     C     00:00:00:00 00:00:08:21 00:00:00:00 00:00:08:21
* FROM CLIP NAME: tearofsteels-segment

002  SHOT001  V     C     00:00:08:22 00:00:13:10 00:00:08:21 00:00:13:10
* FROM CLIP NAME: tearofsteels-segment

...

```

___

## Security

HTTPS request is authenticated with a valid AWS crendential. Upon sign in to the web portal, Amazon Cognito issues a temporary AWS security credential to the authenticated user to access limited AWS resources.

### IAM Role given to an Authenticated Amazon Cognito User
The authenicated user is given access to **invoke** the RESTful API endpoint and GetObject and PutObject to the **source** S3 bucket.

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": "cognito-identity:GetId",
            "Resource": "arn:aws:cognito-identity:<region>:<account>:identitypool/<region>:<guid>",
            "Effect": "Allow"
        },
        {
            "Action": "execute-api:Invoke",
            "Resource": "arn:aws:execute-api:<region>:<account>:<api-id>/*/*/*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::<source-bucket>",
                "arn:aws:s3:::<source-bucket>/*"
            ],
            "Effect": "Allow"
        }
    ]
}

```
__

### IAM Role used by the API backend Lambda Function
The backend API lambda function is given the following permission to access specific resources such as Amazon S3 bucket and AWS Step Functions to start and describe executions.

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "arn:aws:logs:<region>-<account>:log-group:/aws/lambda/*",
            "Effect": "Allow"
        },
        {
            "Action": "s3:ListBucket",
            "Resource": "arn:aws:s3:::<source-bucket>",
            "Effect": "Allow"
        },
        {
            "Action": [
                "s3:GetObject",
                "s3:GetObjectAcl",
                "s3:GetObjectVersion",
                "s3:GetObjectTagging",
                "s3:PutObject"
            ],
            "Resource": "arn:aws:s3:::<source-bucket>/*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "states:DescribeStateMachine",
                "states:StartExecution",
                "states:ListExecutions"
            ],
            "Resource": "arn:aws:states:<region>-<account>:stateMachine:ml9801-<guid>-shot-detection",
            "Effect": "Allow"
        },
        {
            "Action": [
                "states:DescribeExecution",
                "states:StopExecution",
                "states:GetExecutionHistory"
            ],
            "Resource": "arn:aws:states:<region>-<account>:execution:ml9801-<guid>-shot-detection:*",
            "Effect": "Allow"
        }
    ]
}

```

___

Next to [Shot Detection State Machine](../step/README.md) | Back to [README](../../README.md)
