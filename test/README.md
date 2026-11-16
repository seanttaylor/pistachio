The Pistachio test suite is principally concerned with 3 broad categories of questions. They are outlined below. 

The structure of the unit test folder `/tests` reflects the major quality of service and technical requirements that follow.

## Domain Objects
*Do the objects behave correctly independently of HTTP?*
- Do collections expose and resolve their instances correctly?
- Do accessors return the expected relations?
- Do procedures operate on the correct objects?
- Does serialization produce the expected representations?
- Do mutations have the expected effects?
## Framework Execution
*Does Pistachio correctly interpret and execute the domain declarations?*
- Does it discover collections and relations?
- Does it resolve the appropriate instances?
- Does it select the correct procedure target?
- Does it translate request context into procedure arguments?
- Does it handle missing resources and execution errors correctly?

## HTTP Integration Tests
*Does the resulting HTTP interface behave correctly?*
- Are the expected routes registered?
- Do GET, POST, PUT, and DELETE invoke the correct operations?
- Are status codes, headers, and response bodies correct?
- Do invalid requests produce the expected errors?