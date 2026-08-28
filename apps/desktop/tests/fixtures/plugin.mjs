export default function activate(context) {
  context.publish("ready", { package: context.package.id });
  return () => {};
}
