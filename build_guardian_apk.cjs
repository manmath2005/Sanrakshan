const fs = require('fs');
const cp = require('child_process');
const path = require('path');

const sdkPlatform = 'C:/Users/Bhagyashri Sangave/AppData/Local/Android/Sdk/platforms/android-34/android.jar';
const sdkTools = 'C:/Users/Bhagyashri Sangave/AppData/Local/Android/Sdk/build-tools/34.0.0';
const d8Jar = path.join(sdkTools, 'lib', 'd8.jar');
const zipalign = path.join(sdkTools, 'zipalign.exe');
const apksignerJar = path.join(sdkTools, 'lib', 'apksigner.jar');

const srcDir = 'E:/Website/2_Android_APK_App/source_code/src/com/sankalp/smarthelmet';
const classesDir = 'E:/apk_temp/classes';
const dexDir = 'E:/apk_temp/dex';

console.log('=== Step 1: Compiling Java Sources ===');
if (fs.existsSync(classesDir)) fs.rmSync(classesDir, { recursive: true, force: true });
if (fs.existsSync(dexDir)) fs.rmSync(dexDir, { recursive: true, force: true });
fs.mkdirSync(classesDir, { recursive: true });
fs.mkdirSync(dexDir, { recursive: true });

const javaFiles = fs.readdirSync(srcDir)
  .filter(f => f.endsWith('.java'))
  .map(f => `"${path.join(srcDir, f)}"`);

console.log(`Found ${javaFiles.length} Java source files.`);
const compileCmd = `javac --release 17 -cp "${sdkPlatform}" -d "${classesDir}" ${javaFiles.join(' ')}`;
cp.execSync(compileCmd, { stdio: 'inherit' });
console.log('✅ Java compilation succeeded!');

console.log('\n=== Step 2: Running D8 DEX Compiler ===');
function getAllFiles(dir, ext) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(filePath, ext));
    } else if (file.endsWith(ext)) {
      results.push(`"${filePath}"`);
    }
  }
  return results;
}

const classFiles = getAllFiles(classesDir, '.class');
console.log(`Found ${classFiles.length} compiled class files.`);
const dexCmd = `java -cp "${d8Jar}" com.android.tools.r8.D8 --lib "${sdkPlatform}" --min-api 26 --output "${dexDir}" ${classFiles.join(' ')}`;
cp.execSync(dexCmd, { stdio: 'inherit' });
console.log('✅ D8 DEX compilation succeeded!');

console.log('\n=== Step 3: Packaging and Signing Guardian APK ===');
fs.copyFileSync(path.join(dexDir, 'classes.dex'), 'E:/apk_temp/classes.dex');

const metaInf = 'E:/apk_temp/META-INF';
if (fs.existsSync(metaInf)) {
  fs.rmSync(metaInf, { recursive: true, force: true });
}

const unalignedApk = 'E:/apk_temp/unaligned.apk';
if (fs.existsSync(unalignedApk)) fs.unlinkSync(unalignedApk);

const filesToZip = ['AndroidManifest.xml', 'classes.dex', 'resources.arsc', 'res'];
console.log('Creating unaligned APK with jar...');
cp.execSync(`jar -c0f "${unalignedApk}" ${filesToZip.join(' ')}`, {
  cwd: 'E:/apk_temp',
  stdio: 'inherit'
});

const alignedApk = 'E:/apk_temp/aligned.apk';
if (fs.existsSync(alignedApk)) fs.unlinkSync(alignedApk);
console.log('Running zipalign...');
cp.execSync(`"${zipalign}" -f -p 4 "${unalignedApk}" "${alignedApk}"`, {
  stdio: 'inherit'
});

const keystore = 'E:/apk_temp/smarthelmet.keystore';
if (!fs.existsSync(keystore)) {
  console.log('Generating keystore...');
  cp.execSync(`keytool -genkeypair -v -keystore "${keystore}" -storepass android -alias smarthelmet -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=SmartHelmet,O=Sankalp,C=IN"`, {
    stdio: 'inherit'
  });
}

const finalApk = 'E:/Website/2_Android_APK_App/SmartHelmet.apk';
console.log('Signing APK with apksigner...');
cp.execSync(`java -jar "${apksignerJar}" sign --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true --ks "${keystore}" --ks-pass pass:android --ks-key-alias smarthelmet --key-pass pass:android --out "${finalApk}" "${alignedApk}"`, {
  stdio: 'inherit'
});

console.log('Verifying signed APK...');
cp.execSync(`java -jar "${apksignerJar}" verify --verbose "${finalApk}"`, {
  stdio: 'inherit'
});

const guardianApk = 'E:/Website/2_Android_APK_App/Guardian.apk';
fs.copyFileSync(finalApk, guardianApk);

const destDirs = [
  'E:/Website/downloads',
  'E:/sanrakshan_deploy/downloads',
  'E:/SmartHelmetTracker/downloads'
];

for (const dir of destDirs) {
  if (fs.existsSync(dir)) {
    fs.copyFileSync(finalApk, path.join(dir, 'Guardian.apk'));
    fs.copyFileSync(finalApk, path.join(dir, 'SmartHelmet.apk'));
    console.log(`Synced updated APK to: ${dir}`);
  }
}

const apkSize = fs.statSync(finalApk).size;
console.log('\n🎉 ALL DONE! Guardian APK successfully built, aligned, signed, and deployed!');
console.log(`Final APK Size: ${apkSize} bytes`);
console.log(`Outputs synced to all download folders.`);
