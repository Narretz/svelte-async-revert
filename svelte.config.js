import adapter from '@sveltejs/adapter-auto';

export default {
  compilerOptions: {
    experimental: { async: true }
  },
  kit: { adapter: adapter() }
};
