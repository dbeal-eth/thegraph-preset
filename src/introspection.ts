import axios from 'axios';
import { gql } from 'graphql-request';

import { GraphQLSchema } from 'graphql';

export const INTROSPECTION_QUERY = gql`
query IntrospectionQuery {
  __schema {
    types {
      name
      inputFields {
        name
        type {
          name
          kind
          ofType {
            name
            kind
            ofType {
              name
              kind
              ofType {
                name
                kind
              }
            }
          }
        }
      }
      fields {
        name
        type {
          name
          kind
          ofType {
            name
            kind
            ofType {
              name
              kind
              ofType {
                name
                kind
              }
            }
          }
        }
      }
    }
  }
}
`;

export async function pull(url: string): Promise<GraphQLSchema> {
    const res = await axios(url, {
      method: 'POST',
      data: JSON.stringify({ query: INTROSPECTION_QUERY }),
    });
  
    const rawSchema = new GraphQLSchema(res.data.data.__schema);
  
    return rawSchema;
}