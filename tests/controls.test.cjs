const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Exercise event handlers; native Android touch routing still needs a device check.
function button(disabled = false) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../src/components/PowerUpButton.tsx'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  }}).outputText;
  const requireMock = name => {
    if (name === 'react') return { useRef: value => ({ current: value }) };
    if (name === 'react-native') return { View: 'View' };
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }) };
    throw new Error(name);
  };
  new Function('require', 'exports', code)(requireMock, exports);
  let activations = 0;
  const view = exports.PowerUpButton({ disabled, label: 'Power', onActivate: () => activations++, children: null });
  return { props: view.props, count: () => activations };
}
const event = (changed, active) => ({ nativeEvent: {
  changedTouches: changed.map(identifier => ({ identifier })),
  touches: active.map(identifier => ({ identifier })),
}});

test('power activates once while joystick finger remains held and allows repeated taps', () => {
  const b = button();
  b.props.onTouchStart(event([2], [1, 2]));
  assert.equal(b.count(), 1);
  b.props.onTouchStart(event([3], [1, 2, 3]));
  assert.equal(b.count(), 1);
  b.props.onTouchEnd(event([2], [1]));
  b.props.onTouchStart(event([4], [1, 4]));
  assert.equal(b.count(), 2);
  b.props.onTouchCancel(event([4], [1]));
  b.props.onTouchStart(event([5], [1, 5]));
  assert.equal(b.count(), 3);
});

test('empty slots ignore touches and accessibility activation', () => {
  const b = button(true);
  b.props.onTouchStart(event([2], [1, 2]));
  b.props.onAccessibilityTap();
  assert.equal(b.count(), 0);
});

test('power remains accessible without touch gestures', () => {
  const b = button();
  b.props.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } });
  assert.equal(b.count(), 1);
});
