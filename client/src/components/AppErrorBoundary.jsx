import { Component } from "react";

export default class AppErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><section className="max-w-lg rounded-3xl bg-white p-8 shadow-sm"><h1 className="text-xl font-bold text-slate-800">This page could not be displayed.</h1><p className="mt-2 text-sm text-slate-600">{this.state.error.message}</p><button onClick={() => { this.setState({ error: null }); window.location.href = "/patients"; }} className="mt-5 rounded-xl bg-pink-600 px-4 py-2.5 font-semibold text-white">Back to patients</button></section></main>;
    return this.props.children;
  }
}
