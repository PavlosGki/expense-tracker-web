const fs = require('fs');

const path = '/Users/pavlosgkinis/Documents/Coding/expense-tracker-web/src/App.tsx';
let content = fs.readFileSync(path, 'utf8');

// The three sections are:
// 1. Monthly (starts with <section className="panel budget-panel"> and has monthlyBudget)
// 2. Yearly (starts with <section className="panel budget-panel"> and has yearlyBudget)
// 3. Gauges (starts with {/* Slide 3: 50/30/20 Gauges */} or <section className="panel budget-panel" style={{ display: 'flex', flexDirection: 'column' }}>)

const sectionRegex = /<section className="panel budget-panel">[\s\S]*?<\/section>/g;
const gaugeRegex = /\{\/\* Slide 3: 50\/30\/20 Gauges \*\/\}[\s\S]*?<section className="panel budget-panel" style=\{\{ display: 'flex', flexDirection: 'column' \}\}>[\s\S]*?<\/section>/g;

let monthlySection = '';
let yearlySection = '';
let gaugeSection = '';

const monthlyMatch = content.match(/<section className="panel budget-panel">[\s\S]*?monthlyBudget[\s\S]*?<\/section>/);
const yearlyMatch = content.match(/<section className="panel budget-panel">[\s\S]*?yearlyBudget[\s\S]*?<\/section>/);
const gaugeMatch = content.match(/\{\/\* Slide 3: 50\/30\/20 Gauges \*\/\}[\s\S]*?<section className="panel budget-panel" style=\{\{ display: 'flex', flexDirection: 'column' \}\}>[\s\S]*?<\/section>/);

if (monthlyMatch && yearlyMatch && gaugeMatch) {
  monthlySection = monthlyMatch[0];
  yearlySection = yearlyMatch[0];
  gaugeSection = gaugeMatch[0];

  // Replace the entire block
  const fullMatchRegex = new RegExp(monthlySection.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + yearlySection.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + gaugeSection.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  
  const newBlock = gaugeSection.replace('Slide 3', 'Slide 1') + '\n\n              ' + monthlySection + '\n\n              ' + yearlySection;
  
  content = content.replace(fullMatchRegex, newBlock);
  
  // Also change the default slide to 1
  content = content.replace(
    /const activeBudgetSlideRef = useRef\(Number\(localStorage\.getItem\('expense_active_budget_slide'\)\) \|\| 0\);/,
    "const storedSlide = localStorage.getItem('expense_active_budget_slide');\n  const activeBudgetSlideRef = useRef(storedSlide !== null ? Number(storedSlide) : 1);"
  );

  // Note: the `activeBudgetSlide === 2` gauge animation condition should be changed to `activeBudgetSlide === 0`
  content = content.replace(
    /if \(activeBudgetSlide === 2\) \{/g,
    "if (activeBudgetSlide === 0) {"
  );

  fs.writeFileSync(path, content, 'utf8');
  console.log("Success");
} else {
  console.log("Failed to match sections");
}
