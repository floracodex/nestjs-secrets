// test/__mocks__/consul.ts

// This is the core mock function for kv.get that our tests will interact with.
const mockKvGet = jest.fn();

// This is the mock constructor function that will be used when 'new Consul()' is called.
const mockConsulModule = jest.fn().mockImplementation((options?: any) => {
  // The instance returned by 'new Consul()' will have this structure:
  return {
    kv: {
      get: mockKvGet, // All instances will share the same mockKvGet function.
    },
    // Mock other methods of the Consul client if the provider uses them.
    // For example, if provider uses consul.watch():
    // watch: jest.fn().mockImplementation(opts => ({
    //   on: jest.fn((event, handler) => { /* mock .on behavior */ }),
    //   end: jest.fn(),
    // })),
  };
});

// Attach mockKvGet to a custom property on the mock constructor itself.
// This allows tests to access mockKvGet via the imported (mocked) Consul module.
// The 'any' type assertion is used because '_mockKvGet' is not a standard property.
(mockConsulModule as any)._mockKvGet = mockKvGet;

// This makes mockConsulModule the default export of the mocked 'consul' module.
export default mockConsulModule;
