export const REPO_FIELD_PLACEHOLDER = '__selected_field__';

export const REPOSITORY_SEVERITY_OPTIONS = ['Standard', 'Important', 'Critical'];
export const REPOSITORY_SPACE_OPTIONS = ['Global Repository', 'Team Shared', 'Personal'];

export const VALIDATION_LIBRARY_CATEGORIES = ['Validity', 'Format', 'Completeness', 'Consistency', 'Reference'];
export const CLEANING_LIBRARY_CATEGORIES = ['Standardization', 'Replacement', 'Missing Data', 'Text Transform', 'Formatting'];

export const VALIDATION_DATA_TYPE_OPTIONS = [
    { id: 'text', label: 'Text' },
    { id: 'number', label: 'Number' },
    { id: 'date', label: 'Date' },
];

export const VALIDATION_OPERATOR_OPTIONS = [
    { id: 'equals', label: '=' },
    { id: 'not_equals', label: '!=' },
    { id: 'starts_with', label: 'Starts with' },
    { id: 'not_starts_with', label: 'Does not start with' },
    { id: 'ends_with', label: 'Ends with' },
    { id: 'not_ends_with', label: 'Does not end with' },
    { id: 'contains', label: 'Contains' },
    { id: 'not_contains', label: 'Does not contain' },
    { id: 'matches_regex', label: 'Matches regex' },
    { id: 'greater_than', label: 'Greater than' },
    { id: 'less_than', label: 'Less than' },
    { id: 'between', label: 'Between' },
    { id: 'not_null', label: 'Is not empty' },
];

const cloneJson = (value) => JSON.parse(JSON.stringify(value));
const quote = (value) => JSON.stringify(String(value ?? ''));

const asNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export function buildValidationTemplatePayload(form) {
    const operator = form.operator || 'equals';
    const primaryValue = form.primary_value ?? '';
    const secondaryValue = form.secondary_value ?? '';
    const dataType = form.data_type || 'text';
    let generatedRuleType = 'custom_expression';
    let generatedParams = {};

    if (operator === 'starts_with') {
        generatedRuleType = 'starts_with';
        generatedParams = { prefix: String(primaryValue) };
    } else if (operator === 'ends_with') {
        generatedRuleType = 'ends_with';
        generatedParams = { suffix: String(primaryValue) };
    } else if (operator === 'matches_regex') {
        generatedRuleType = 'regex_custom';
        generatedParams = { regex: String(primaryValue) };
    } else if (operator === 'greater_than') {
        generatedRuleType = 'value_gt';
        generatedParams = { value: asNumber(primaryValue) };
    } else if (operator === 'less_than') {
        generatedRuleType = 'value_lt';
        generatedParams = { value: asNumber(primaryValue) };
    } else if (operator === 'between') {
        generatedRuleType = 'value_between';
        generatedParams = { min: asNumber(primaryValue), max: asNumber(secondaryValue) };
    } else if (operator === 'not_null') {
        generatedRuleType = 'not_null';
        generatedParams = {};
    } else {
        let expression = 'True';
        const numericValue = asNumber(primaryValue);
        const valueReference = dataType === 'number' ? numericValue : quote(primaryValue);
        const textValueReference = quote(primaryValue);

        if (operator === 'equals') {
            expression = dataType === 'number'
                ? `float(value) == ${numericValue}`
                : `str(value) == ${valueReference}`;
        } else if (operator === 'not_equals') {
            expression = dataType === 'number'
                ? `float(value) != ${numericValue}`
                : `str(value) != ${valueReference}`;
        } else if (operator === 'contains') {
            expression = `${textValueReference} in str(value)`;
        } else if (operator === 'not_contains') {
            expression = `${textValueReference} not in str(value)`;
        } else if (operator === 'not_starts_with') {
            expression = `not str(value).startswith(${textValueReference})`;
        } else if (operator === 'not_ends_with') {
            expression = `not str(value).endswith(${textValueReference})`;
        }

        generatedRuleType = 'custom_expression';
        generatedParams = { expression };
    }

    return {
        logic_type: operator === 'matches_regex' ? 'pattern' : 'condition',
        definition: {
            variable_name: form.variable_name || 'field_value',
            data_type: dataType,
            operator,
            primary_value: primaryValue,
            secondary_value: secondaryValue,
            placeholder_column: REPO_FIELD_PLACEHOLDER,
            generated_rule_type: generatedRuleType,
            generated_params: cloneJson(generatedParams),
        },
        rules: [
            {
                column: REPO_FIELD_PLACEHOLDER,
                rule_type: generatedRuleType,
                params: cloneJson(generatedParams),
            },
        ],
    };
}

export function buildCleaningTemplatePayload(form) {
    const params = cloneJson(form.params || {});
    return {
        operation_kind: form.operation || 'replace_value',
        definition: {
            variable_name: form.variable_name || 'field_value',
            operation: form.operation || 'replace_value',
            params,
            placeholder_column: REPO_FIELD_PLACEHOLDER,
        },
        operations: [
            {
                column: REPO_FIELD_PLACEHOLDER,
                operation: form.operation || 'replace_value',
                params,
            },
        ],
    };
}

export function getRepoTemplateEntries(item, context) {
    return context === 'validation' ? (item.rules || []) : (item.operations || []);
}

export function templateNeedsFieldMapping(item, context) {
    return getRepoTemplateEntries(item, context).some((entry) => !entry.column || entry.column === REPO_FIELD_PLACEHOLDER);
}

export function getTemplateFieldPrompts(item, context) {
    const entries = getRepoTemplateEntries(item, context);
    return entries.map((entry, index) => ({
        key: `${context}_${index}`,
        index,
        label: entry.template_label || item.definition?.variable_name || `${item.name} field`,
        currentColumn: entry.column || '',
    }));
}

export function applyTemplateFieldMappings(item, context, mappingByIndex = {}) {
    return getRepoTemplateEntries(item, context).map((entry, index) => ({
        ...cloneJson(entry),
        column: mappingByIndex[index] || entry.column || '',
    }));
}
