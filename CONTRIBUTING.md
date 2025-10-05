# Contributing to VaultPlay Draw Worker

Thank you for your interest in contributing to VaultPlay Draw Worker! We welcome contributions from the community.

## Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to uphold this code. Please be respectful and constructive in all interactions.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- Clear and descriptive title
- Detailed steps to reproduce the issue
- Expected vs actual behavior
- Code samples or test cases if applicable
- Your environment details (OS, Node version, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- Clear and descriptive title
- Detailed description of the proposed functionality
- Explanation of why this enhancement would be useful
- Possible implementation approach (optional)

### Pull Requests

1. Fork the repository
2. Create a new branch from `main`:
   ```bash
   git checkout -b feature/my-new-feature
   ```
3. Make your changes
4. Ensure your code follows the existing style
5. Update documentation as needed
6. Commit your changes with clear messages:
   ```bash
   git commit -m "Add feature: description of feature"
   ```
7. Push to your fork:
   ```bash
   git push origin feature/my-new-feature
   ```
8. Open a Pull Request

## Development Guidelines

### Code Style

- Use clear, descriptive variable and function names
- Add comments for complex logic
- Follow existing code formatting patterns
- Keep functions focused and single-purpose

### Security Considerations

This is a security-critical application. All contributions must:

- Maintain deterministic behavior
- Avoid introducing external dependencies during draw calculation
- Not compromise the cryptographic integrity of the system
- Include proper input validation

### Testing

Before submitting:

- Test your changes with various input scenarios
- Verify deterministic behavior (same inputs = same outputs)
- Check edge cases and error handling

### Documentation

- Update README.md if adding features
- Add code comments for complex algorithms
- Update API documentation for interface changes

## Questions?

Feel free to open an issue with the "question" label if you need clarification on anything.

Thank you for contributing!