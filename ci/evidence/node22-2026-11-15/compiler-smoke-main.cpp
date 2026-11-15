#include "compiler-smoke.hpp"
#include <cassert>
int main() {
    strucpp::Program_COMPILERSMOKE program;
    assert(program.COUNTER == 0);
    program.run();
    program.run();
    assert(program.COUNTER == 2);
    program.ENABLE = false;
    program.run();
    assert(program.COUNTER == 2);
}
