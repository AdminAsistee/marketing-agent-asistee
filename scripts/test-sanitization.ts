// Validation script for the sanitization layer regexes
const sanitizeField = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/\\n/g, '\n') // Convert literal \n escape characters
    .replace(/\*\*(.*?)\*\*/g, '$1') // Strip bold asterisks
    .replace(/\*(.*?)\*/g, '$1') // Strip italic asterisks
    .replace(/__(.*?)__/g, '$1') // Strip bold underscores
    .replace(/_(.*?)_/g, '$1') // Strip italic underscores
    .replace(/^#+\s+/gm, '') // Strip markdown heading markers
    .replace(/```[a-zA-Z]*/g, '') // Strip code block starts
    .replace(/```/g, '') // Strip code block ends
    .replace(/\n{3,}/g, '\n\n') // Normalize excessive newlines
    .trim();
};

const testCases = [
  {
    input: "## Heading With Hashtags",
    expected: "Heading With Hashtags"
  },
  {
    input: "**Bold text** and *italic text*",
    expected: "Bold text and italic text"
  },
  {
    input: "Some text\\nwith a newline",
    expected: "Some text\nwith a newline"
  },
  {
    input: "```markdown\n## Code block content\n```",
    expected: "Code block content"
  },
];

console.log("--- RUNNING SANITIZATION TESTS ---");
let success = true;
for (const tc of testCases) {
  const result = sanitizeField(tc.input);
  if (result === tc.expected) {
    console.log(`PASS: "${tc.input.replace(/\n/g, '\\n')}" -> "${result.replace(/\n/g, '\\n')}"`);
  } else {
    console.error(`FAIL: "${tc.input.replace(/\n/g, '\\n')}" -> expected "${tc.expected.replace(/\n/g, '\\n')}", got "${result.replace(/\n/g, '\\n')}"`);
    success = false;
  }
}

if (!success) {
  process.exit(1);
}
console.log("--- ALL SANITIZATION REGEXES PASSED SUCCESSFULLY ---");
