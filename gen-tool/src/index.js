import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Mustache from 'mustache';
import yaml from 'js-yaml';
import langs from './i18n/lang.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const args_lang = args.find(arg => arg.startsWith('--lang='));
const lang = args_lang ? args_lang.split('=')[1] : 'en';
const t = langs[lang];

// Validate language support
if (!t) {
  console.error(`❌ Language '${lang}' not supported. Available languages: ${Object.keys(langs).join(', ')}`);
  process.exit(1);
}

console.log(`🌐 Generating README for language: ${lang}`);

// read all case files
const caseDirs = fs.readdirSync(path.join(__dirname, '../../cases'));
const numericDirs = caseDirs.filter(dir => !isNaN(dir));
let cases = numericDirs.map(dir => {
  const caseNumber = parseInt(dir);
  const casePath = path.join(__dirname, '../../cases', dir, 'case.yml');
  const caseData = yaml.load(fs.readFileSync(casePath, 'utf8'));
  const attributionPath = path.join(__dirname, '../../cases', dir, 'ATTRIBUTION.yml');
  const attributionData = yaml.load(fs.readFileSync(attributionPath, 'utf8'));
  return {
    case_no: caseNumber,
    ...caseData,
    attribution: attributionData
  };
});

// Sort cases in descending order by case number
cases.sort((a, b) => b.case_no - a.case_no);

console.log(`📊 Found ${cases.length} cases to process`);

// Helper function to get field value based on language
function getLocalizedField(caseData, fieldName) {
  if (lang === 'ja') {
    // Japanese: try _ja field first, then fallback to Chinese, then English
    return caseData[`${fieldName}_ja`] || caseData[fieldName] || caseData[`${fieldName}_en`] || '';
  } else if (lang === 'en') {
    // English: try _en field first, then fallback to Chinese
    return caseData[`${fieldName}_en`] || caseData[fieldName] || '';
  } else {
    // Chinese (zh): use base field, fallback to English
    return caseData[fieldName] || caseData[`${fieldName}_en`] || '';
  }
}

// render cases
const case_template = fs.readFileSync(path.join(__dirname, '../templates/case.md'), 'utf8');
let cases_contents = '';

for (const c of cases) {
    const source_links = c.source_links.length === 1
      ? `[${t.source_link_caption}](${c.source_links[0].url})`
    : c.source_links.map((link, i) => `[${t.source_link_caption}${i + 1}](${link.url})`).join(' | ');

    // Get localized content based on language
    const title = getLocalizedField(c, 'title');
    const alt_text = getLocalizedField(c, 'alt_text');
    const prompt = getLocalizedField(c, 'prompt');
    const prompt_note = getLocalizedField(c, 'prompt_note');
    const reference_note = getLocalizedField(c, 'reference_note');
    
    // Get attribution title
    const attribution_title = getLocalizedField(c.attribution, 'title');

    console.log(`📝 Processing Case ${c.case_no}: ${title.substring(0, 30)}...`);

    cases_contents += Mustache.render(case_template, {
      case_no: c.case_no,
      t: t,
      title: title.trim(),
      author: c.author,
      author_link: c.author_link,
      source_links: source_links,
      image: c.image,
      alt_text: alt_text.trim(),
      attribution: {
        ...c.attribution,
        title: attribution_title
      },
      prompt: prompt.trim(),
      prompt_note: prompt_note.trim(),
      reference_note: reference_note.trim(),
      submitter: c.submitter || '',
      submitter_link: c.submitter_link || '',
    }) + '\n';
}

// Data for the README template
const data = {
  't': t,
  'cases': cases.map(c => ({
    case_no: c.case_no,
    title: getLocalizedField(c, 'title'),
    author: c.author,
  })),
  'header': fs.readFileSync(path.join(__dirname, '../templates', lang, 'header.md'), 'utf8'),
  'table-of-contents': fs.readFileSync(path.join(__dirname, '../templates', lang, 'table-of-contents.md'), 'utf8'),
  'gpt4o-intro': fs.readFileSync(path.join(__dirname, '../templates', lang, 'gpt4o-intro.md'), 'utf8'),
  'cases-contents': cases_contents,
  'tools-intro': fs.readFileSync(path.join(__dirname, '../templates', lang, 'tools-intro.md'), 'utf8'),
  'acknowledgements': fs.readFileSync(path.join(__dirname, '../templates', lang, 'acknowledgements.md'), 'utf8')
};

// Render the README template
const readmeTemplate = fs.readFileSync(path.join(__dirname, '../templates/README.md.md'), 'utf8');
const renderedReadme = Mustache.render(readmeTemplate, data);

// Determine output filenames based on language
let filenames = [];
switch(lang) {
  case 'en':
    // For English, generate both README.md (default) and README_en.md (explicit)
    filenames = ['README.md', 'README_en.md'];
    break;
  case 'zh':
    filenames = ['README_cn.md'];
    break;
  case 'ja':
    filenames = ['README_ja.md'];
    break;
  default:
    filenames = [`README_${lang}.md`];
}

// Write the rendered README to all specified filenames
filenames.forEach(filename => {
  const outputPath = path.join(__dirname, '../..', filename);
  fs.writeFileSync(outputPath, renderedReadme);
  console.log(`✅ ${filename} generated successfully!`);
  console.log(`📁 Output location: ${outputPath}`);
});

// Summary
console.log('\n📊 Generation Summary:');
console.log(`   • Language: ${lang}`);
console.log(`   • Cases processed: ${cases.length}`);
console.log(`   • Output files: ${filenames.join(', ')}`);
console.log(`   • Template directory: templates/${lang}/`);

if (lang === 'en') {
  console.log('\n🇺🇸 English-specific info:');
  console.log('   • Generated both README.md (default) and README_en.md (explicit)');
  console.log('   • This ensures clear multi-language support');
}

if (lang === 'ja') {
  console.log('\n🇯🇵 Japanese-specific info:');
  console.log('   • Using _ja fields from YAML files');
  console.log('   • Fallback order: _ja → base → _en');
  console.log('   • Japanese templates loaded from templates/ja/');
}