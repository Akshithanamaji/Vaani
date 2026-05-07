const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'components', 'voice-form.tsx');

try {
  console.log('Reading:', filePath);
  // Read the raw file buffer
  const buffer = fs.readFileSync(filePath);
  
  // Convert to UTF-8. Node's 'utf8' encoding will automatically 
  // replace invalid byte sequences with the Unicode replacement character ().
  const text = buffer.toString('utf8');
  
  // Write the valid UTF-8 string back to the file
  fs.writeFileSync(filePath, text, 'utf8');
  console.log('Success! The file has been repaired.');
  console.log('Please check components/voice-form.tsx for any "" characters and fix them if necessary.');
} catch (err) {
  console.error('Error:', err);
}
