import { ArgumentNode, DocumentNode, FieldDefinitionNode, FieldNode, InputObjectTypeDefinitionNode, NameNode, ObjectTypeDefinitionNode, OperationDefinitionNode, parse, print, VariableDefinitionNode } from "graphql";

const NON_ENTITY_NAMES = [
    'Query',
    'Mutation',
    'Subscription',
    '_Block_',
    '_Meta_'
]

export default function genDocument(docString: string, config: { schema: DocumentNode }): DocumentNode {
    // generate document node with queries
    // schema is in `config.schema`
    //const astNode = getCachedDocumentNodeFromSchema(config.schema) // Transforms the GraphQLSchema into ASTNode

    const queries = [];

    const definitions = config.schema.definitions;

    // all the objects we care about are on the top level of the schema
    for (const def of definitions) {
        if (def.kind === 'ObjectTypeDefinition') {
            if (NON_ENTITY_NAMES.indexOf(def.name.value) !== -1) {
                continue;
            }

            const inputObjectType = definitions.find(t => 
                t.kind === 'InputObjectTypeDefinition' && 
                t.name.value === `${def.name.value}_filter`
            ) as InputObjectTypeDefinitionNode | undefined;

            if (!inputObjectType) {
                throw new Error(`Could not find filter type for ${def.name.value}. Is this actually manifest from the graph?`);
            }

            queries.push(...generateQueries(def, inputObjectType, config.schema));
        }
    }

    console.log(print(
        {
            kind: 'Document',
            definitions: queries
        }
    ));

    return {
        kind: 'Document',
        definitions: queries
    };
};

/**
 * Generates opinionated queries convenient for pulling documents from the graph
 * @param entity ASTNode for the entity to generate queries for
 */
function generateQueries(entity: ObjectTypeDefinitionNode, inputFilter: InputObjectTypeDefinitionNode, schema: DocumentNode): OperationDefinitionNode[] {

    const queryName = queryFunctionName(entity.name);

    const variableDefinition = (options: { name: string, type: string, nonNull?: boolean, defaultValue?: string }): VariableDefinitionNode => ({
        kind: 'VariableDefinition',
        variable: {
            kind: 'Variable',
            name: {
                kind: 'Name',
                value: options.name,
            },
        },
        type: options.nonNull ? {
            kind: 'NonNullType',
            type: {
                kind: 'NamedType',
                name: {
                    kind: 'Name',
                    value: options.type
                }
            }
        } : {
            kind: 'NamedType',
            name: {
                kind: 'Name',
                value: options.type
            }
        },
        defaultValue: options.defaultValue && (options.type === 'Int' || options.type === 'String') ? {
            kind: `${options.type}Value`,
            value: options.defaultValue
        } : undefined
    });

    const argument = (options: { name: string, variable: string }): ArgumentNode => ({
        kind: 'Argument',
        name: {
            kind: 'Name',
            value: options.name
        },
        value: {
            kind: 'Variable',
            name: {
                kind: 'Name',
                value: options.variable
            }
        }
    });

    return [
        // one query
        {
            kind: 'OperationDefinition',
            operation: 'query',
            name: {
                kind: 'Name',
                value: `GetOne${entity.name.value}`
            },
            variableDefinitions: [
                variableDefinition({ name: 'id', type: 'ID', nonNull: true })
            ],
            selectionSet: {
                kind: 'SelectionSet',
                selections: [
                    {
                        kind: 'Field',
                        name: {
                            kind: 'Name',
                            value: queryName
                        },
                        arguments: [
                            argument({ name: 'id', variable: 'id' })
                        ],
                        selectionSet: {
                            kind: 'SelectionSet',
                            selections: entity.fields?.map((f) => fieldDefinitionToField(f, schema)) || []
                        }
                    }
                ]
            }
        },

        // many query
        {
            kind: 'OperationDefinition',
            operation: 'query',
            name: {
                kind: 'Name',
                value: `GetMany${entity.name.value}s`
            },
            variableDefinitions: [
                variableDefinition({ name: 'first', type: 'Int', nonNull: true, defaultValue: '0' }),
                variableDefinition({ name: 'skip', type: 'Int', defaultValue: '0' }),
                variableDefinition({ name: 'orderBy', type: `${entity.name.value}_orderBy` }),
                variableDefinition({ name: 'orderDirection', type: 'OrderDirection', defaultValue: 'asc' }),
                variableDefinition({ name: 'where', type: `${entity.name.value}_filter` }),
            ],
            selectionSet: {
                kind: 'SelectionSet',
                selections: [
                    {
                        kind: 'Field',
                        name: {
                            kind: 'Name',
                            value: queryName.endsWith('x') ? queryName + 'es' : queryName + 's'
                        },
                        arguments: [
                            argument({ name: 'first', variable: 'first' }),
                            argument({ name: 'skip', variable: 'skip' }),
                            argument({ name: 'orderBy', variable: 'orderBy' }),
                            argument({ name: 'orderDirection', variable: 'orderDirection' }),
                            argument({ name: 'where', variable: 'where' }),
                        ],
                        selectionSet: {
                            kind: 'SelectionSet',
                            selections: entity.fields?.map((f) => fieldDefinitionToField(f, schema)) || []
                        }
                    }
                ]
            }
        },
    ]
}

function queryFunctionName(node: NameNode) {
    let n = node.value;
  
    for (let i = 0; i < n.length; i++) {
      if (n[i] !== n[i].toUpperCase()) {
        return n.substring(0, i).toLowerCase() + n.substring(i);
      }
    }

    return n;
}

function fieldDefinitionToField(fieldDefinition: FieldDefinitionNode, document: DocumentNode, depth: number = 0): FieldNode {

    // if there are subfields to select, find the object if it exists
    const typeDefinition = document.definitions.find(
        (d) => d.kind === 'ObjectTypeDefinition' && d.name.value === getTypeName(fieldDefinition.type).value
    ) as ObjectTypeDefinitionNode | null;


    //console.log('found type definition', typeDefinition?.name);

    return {
        kind: 'Field',
        name: fieldDefinition.name,
        // TODO: handle arguments
        selectionSet: typeDefinition?.fields ? {
            kind: 'SelectionSet',
            selections: depth >= 3 ? [] : typeDefinition.fields.map((f) => fieldDefinitionToField(f, document, depth + 1))
        } : undefined
    }
}

function getTypeName(type: FieldDefinitionNode['type']): NameNode {
    switch (type.kind) {
        case 'NonNullType':
        case 'ListType':
            return getTypeName(type.type);
        default:
            return type.name;
    }
}