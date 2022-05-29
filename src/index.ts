import { Types } from "@graphql-codegen/plugin-helpers";
import addPlugin from '@graphql-codegen/add';

import genDocument from "./gen-document";

export type TheGraphConfig = {
    language: string
}

export const preset: Types.OutputPreset<TheGraphConfig> = {
    buildGeneratesSection: async (options) => {
        console.log('BUILD GENERATES');
        // load all the subgraphs that we will need

        const presetPlugins = [];

        if (options.presetConfig.language === 'typescript-react-apollo') {
            presetPlugins.push({
                add: {
                    content: `import Wei, { wei } from '@synthetixio/wei';\n`
                }
            }, {
                typescript: {
                    scalars: {
                        ID: 'string',
                        String: 'string',
                        Boolean: 'boolean',
                        Int: 'number',
                        Float: 'number',
                        BigDecimal: 'Wei',
                        BigInt: 'Wei',
                        Bytes: 'string',
                    }
                }
            }, {
                'typescript-operations': {}
            }, {
                add: {
                    content: `
import { withScalars } from "apollo-link-scalars";
import { ApolloLink, HttpLink } from "@apollo/client/core";
import introspectionResult from "./graphql.schema.json";
import { buildClientSchema, IntrospectionQuery } from "graphql";

const schema = buildClientSchema((introspectionResult as unknown) as IntrospectionQuery);

const typesMap = {
    BigInt: {
        serialize: (parsed: unknown): string | null => (parsed instanceof Wei ? parsed.toString() : null),
        parseValue: (raw: unknown): Wei | null => {
            if (!raw) return null; // if for some reason we want to treat empty string as null, for example
            if (typeof raw === 'string') {
                return wei(raw);
            }
        
            throw new Error("invalid value to parse")
        }
    }
};
    
export const EthTypesLink = ApolloLink.from([
    withScalars({ schema, typesMap }),
    //new HttpLink({ uri: "http://example.org/graphql" })
]);
`
                }
            }, {
                'typescript-react-apollo': {

                },
            });

            
        }

        //console.log(options.schema);

        const pluginMap = {
            ...options.pluginMap,
            add: addPlugin,
            typescript: require('@graphql-codegen/typescript'),
            'typescript-operations': require('@graphql-codegen/typescript-operations'),
            'typescript-react-apollo': require('@graphql-codegen/typescript-react-apollo'),
            introspection: require('@graphql-codegen/introspection')
        };

        return [
            {
                filename: options.baseOutputDir + '/index.ts',
                plugins: [
                    ...presetPlugins,
                    ...options.plugins,
                ],
                pluginMap,
                config: options.config,
                schema: options.schema,
                documents: [
                    {
                        document: genDocument('', { schema: options.schema })
                    }
                ],
            },
            {
                filename: options.baseOutputDir + '/graphql.schema.json',
                plugins: [
                    {
                        introspection: {}
                    }
                ],
                pluginMap,
                config: options.config,
                schema: options.schema,
                documents: [
                    {
                        document: genDocument('', { schema: options.schema })
                    }
                ],
            }
        ];
    }
}